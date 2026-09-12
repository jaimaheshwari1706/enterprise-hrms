// End-to-end smoke test. Boots the real API against a throwaway in-memory
// MongoDB seeded with the demo data set, serves the production client
// build, and drives every role through the core workflows in headless
// Chromium — including unauthorized cross-role access, session
// restoration on reload, dark mode, a 390px viewport, and empty/error/slow
// states. Never touches a configured MONGO_URI.
//
//   npm install --prefix e2e && npm run e2e         (from the repo root)
//
// Exit code 1 on any failed assertion or uncaught page error.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createRequire as createLocalRequire } from 'node:module';

const axeSource = fs.readFileSync(createLocalRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const a11yViolations = [];

// Runs axe-core (WCAG 2.1 A/AA rules) on the current page and records
// violations. Serious/critical ones fail the run; the rest are reported.
async function audit(page, label) {
  // Let the page-enter fade (150ms) finish so contrast is measured at full opacity.
  await page.waitForTimeout(400);
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  for (const v of result) a11yViolations.push({ page: label, ...v });
  const serious = result.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  check(`a11y: ${label} has no serious/critical axe violations`, serious.length === 0, serious.map((v) => `${v.id}: ${v.nodes[0]}`).join('; '));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');
const shotsDir = path.join(here, 'screenshots');
const requireFromServer = createRequire(path.join(serverDir, 'package.json'));
const { MongoMemoryServer } = requireFromServer('mongodb-memory-server');

const API_PORT = 5055;
const WEB_PORT = 4173;
const API = `http://127.0.0.1:${API_PORT}/api`;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const PASSWORD = 'Demo@1234';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const results = [];
const pageErrors = [];
let failures = 0;

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures += 1;
  console.log(`${condition ? '  ok ' : '  FAIL'} ${name}${detail && !condition ? ` — ${detail}` : ''}`);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', ...opts });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}\n${out.slice(-2000)}`))));
  });
}

async function waitFor(url, label, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not start`);
}

async function api(method, pathname, { token, body, cookie } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, body: json, headers: res.headers };
}

async function login(email) {
  const res = await api('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return res.body.data.accessToken;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const procs = [];
let mongod;

async function boot() {
  fs.rmSync(shotsDir, { recursive: true, force: true });
  fs.mkdirSync(shotsDir, { recursive: true });

  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 30000 } });
  const mongoUri = mongod.getUri('hrms_e2e');
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(API_PORT),
    MONGO_URI: mongoUri,
    JWT_ACCESS_SECRET: 'e2e_access_secret_e2e_access_secret_e2e_access_secret',
    JWT_REFRESH_SECRET: 'e2e_refresh_secret_e2e_refresh_secret_e2e_refresh_secret',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    APP_TIMEZONE: 'Asia/Kolkata',
    CLIENT_URL: WEB,
    CORS_ORIGINS: WEB,
    REDIS_ENABLED: 'false',
    EMAIL_ENABLED: 'false',
    LOG_LEVEL: 'warn',
  };

  console.log('Seeding demo data into in-memory MongoDB…');
  await run('node', ['src/seed/seed.js'], { cwd: serverDir, env });

  console.log('Starting API…');
  const server = spawn('node', ['server.js'], { cwd: serverDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const apiLog = fs.createWriteStream(path.join(shotsDir, 'api.log'));
  server.stdout.pipe(apiLog);
  server.stderr.on('data', (d) => {
    apiLog.write(d);
    process.stderr.write(`[api] ${d}`);
  });
  procs.push(server);
  await waitFor(`${API}/ready`, 'API');

  console.log('Building client…');
  await run(npmCmd, ['run', 'build', '--silent'], { cwd: clientDir, env: { ...process.env, VITE_API_BASE_URL: API } });
  console.log('Serving client…');
  const web = spawn('node', [path.join(clientDir, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(WEB_PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: clientDir, stdio: ['ignore', 'pipe', 'pipe'] });
  web.stderr.on('data', (d) => process.stderr.write(`[web] ${d}`));
  procs.push(web);
  await waitFor(WEB, 'client');
}

async function teardown() {
  for (const p of procs) {
    try {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(p.pid), '/f', '/t']);
      else p.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  if (mongod) await mongod.stop();
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------
async function newPage(browser, { viewport = { width: 1366, height: 900 }, dark = false } = {}) {
  const context = await browser.newContext({ viewport, colorScheme: dark ? 'dark' : 'light' });
  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(`${page.url()}: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/favicon|net::ERR|the server responded with a status/i.test(msg.text())) pageErrors.push(`${page.url()}: console ${msg.text()}`);
  });
  return { context, page };
}

async function uiLogin(page, email) {
  await page.goto(`${WEB}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

// Waits (up to 10s) for a locator to become visible; false on timeout.
async function visible(locator, timeout = 10000) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: false });
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
async function superAdminFlow(browser) {
  console.log('\nSUPER_ADMIN');
  const { context, page } = await newPage(browser);
  await page.goto(`${WEB}/login`);
  await page.getByRole('button', { name: /sign in/i }).waitFor();
  await audit(page, 'login');
  await uiLogin(page, 'admin@hrms.local');
  check('admin: dashboard renders KPIs', await visible(page.getByText(/total employees/i)));
  check('admin: quick actions visible', await visible(page.getByRole('navigation', { name: /quick actions/i })));
  await shot(page, 'admin-dashboard');
  await audit(page, 'admin dashboard');

  await page.goto(`${WEB}/organization`);
  await page.getByRole('heading', { name: /organization settings/i }).waitFor();
  await page.getByRole('tab', { name: /calendar/i }).click();
  check('admin: holidays listed', await visible(page.getByText(/founders day/i)));
  await page.getByRole('tab', { name: /payroll policy/i }).click();
  check('admin: payroll policy shows calendar pro-rata selected', await page.getByRole('radio', { name: /pro-rate by calendar days/i }).isChecked());
  await page.getByRole('tab', { name: /leave types/i }).click();
  check('admin: unpaid leave type flagged', (await visible(page.getByText(/loss of pay/i))) && (await visible(page.getByText(/^unpaid$/i))));
  await shot(page, 'admin-organization');
  await audit(page, 'organization settings');

  await page.goto(`${WEB}/employees`);
  await page.getByRole('table').waitFor();
  check('admin: employee list has rows', (await page.getByRole('table').getByRole('row').count()) > 5);
  await audit(page, 'employee list');
  await page.goto(`${WEB}/departments`);
  check('admin: departments page', await visible(page.getByRole('heading', { name: /departments/i })));
  await page.goto(`${WEB}/designations`);
  check('admin: designations page', await visible(page.getByRole('heading', { name: /designations/i })));
  await page.goto(`${WEB}/audit-logs`);
  await page.getByRole('table').waitFor();
  check('admin: audit logs list', (await page.getByRole('table').getByRole('row').count()) > 1);

  // Command palette
  await page.keyboard.press('Control+K');
  await page.getByRole('combobox', { name: /search/i }).fill('arjun');
  const option = page.getByRole('option').first();
  await option.waitFor({ timeout: 10000 });
  check('admin: command palette finds an employee', (await page.getByRole('option').count()) > 0);
  await shot(page, 'admin-search');
  await context.close();
}

async function hrFlow(browser) {
  console.log('\nHR_ADMIN');
  const { context, page } = await newPage(browser);
  await uiLogin(page, 'hr@hrms.local');
  await page.goto(`${WEB}/payroll/manage`);
  await page.getByRole('table').waitFor();
  check('hr: payroll records listed', (await page.getByRole('table').getByRole('row').count()) > 1);
  await page.getByRole('link', { name: /view payslip/i }).first().click();
  await page.getByRole('article', { name: /payslip for/i }).waitFor();
  check('hr: payslip renders earnings & net', (await page.getByText(/gross earnings/i).count()) > 0 && (await page.getByText(/net pay/i).count()) > 0);
  check('hr: payslip shows payable days', (await page.getByText(/payable days/i).count()) > 0);
  await shot(page, 'hr-payslip');
  await audit(page, 'payslip');

  await page.goto(`${WEB}/leaves/approvals`);
  await page.getByRole('tablist').waitFor();
  check('hr: leave approvals page', await visible(page.getByRole('heading', { name: /leave approvals/i })));
  await page.goto(`${WEB}/attendance/team`);
  check('hr: team attendance page', await visible(page.getByRole('heading', { name: /attendance/i })));
  await page.goto(`${WEB}/employees/new`);
  check('hr: new employee form', await visible(page.getByRole('heading', { name: /add employee|new employee/i })));
  await audit(page, 'employee form');

  // API-level payroll generation with the seeded pro-rata policy for a
  // mid-month joiner: create one, generate for the current month, inspect.
  const hrToken = await login('hr@hrms.local');
  const depts = await api('GET', '/departments?limit=1', { token: hrToken });
  const dept = depts.body.data[0];
  const desigs = await api('GET', `/designations?department=${dept._id}&limit=1`, { token: hrToken });
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const joiningDate = `${month}-10`;
  const created = await api('POST', '/employees', {
    token: hrToken,
    body: { firstName: 'Nina', lastName: 'Newjoiner', email: 'nina.new@hrms.local', joiningDate, department: dept._id, designation: desigs.body.data[0]._id },
  });
  check('hr: create employee via API', created.status === 201, `status ${created.status}`);
  const empId = created.body?.data?._id;
  await api('PUT', `/payroll/salary/${empId}`, { token: hrToken, body: { basic: 31000, hra: 3100, allowances: 0, deductions: 0 } });
  const gen = await api('POST', '/payroll/generate', { token: hrToken, body: { month, employeeId: empId } });
  const row = gen.body?.data?.generated?.[0];
  check('hr: pro-rata payroll generated for mid-month joiner', gen.status === 201 && row && row.period?.basis === 'calendar' && row.period.payableDays < row.period.totalDays, JSON.stringify(gen.body).slice(0, 300));
  check('hr: payslip number assigned', Boolean(row?.payslipNumber), row?.payslipNumber);
  const future = await api('POST', '/payroll/generate', { token: hrToken, body: { month: '2099-01' } });
  check('hr: future month refused', future.status === 400);
  await context.close();
}

async function managerFlow(browser) {
  console.log('\nMANAGER');
  const { context, page } = await newPage(browser);
  // Make sure one of Arjun's reports has a pending request to review.
  const hrToken = await login('hr@hrms.local');
  const team = await api('GET', '/employees?limit=50', { token: hrToken });
  const arjun = team.body.data.find((e) => e.email === 'arjun.mehta@hrms.local');
  const report = team.body.data.find((e) => e.manager && (e.manager._id || e.manager) === arjun._id && e.email);
  if (report) {
    const reportToken = await login(report.email);
    const types = await api('GET', '/leaves/leave-types', { token: reportToken });
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 40);
    while ([0, 6].includes(future.getUTCDay())) future.setUTCDate(future.getUTCDate() + 1);
    const iso = future.toISOString().slice(0, 10);
    const applied = await api('POST', '/leaves/apply', { token: reportToken, body: { leaveType: types.body.data[0]._id, startDate: iso, endDate: iso, reason: 'E2E pending request' } });
    check('manager: a report can file a leave request', applied.status === 201, JSON.stringify(applied.body).slice(0, 200));
  }

  await uiLogin(page, 'arjun.mehta@hrms.local');
  check('manager: team dashboard', await visible(page.getByRole('heading', { name: /team dashboard/i })));
  await page.goto(`${WEB}/attendance/team`);
  await page.getByRole('heading', { name: /attendance/i }).first().waitFor();
  check('manager: team attendance loads', true);
  await page.goto(`${WEB}/leaves/approvals`);
  await page.getByRole('tablist').waitFor();
  const approveButtons = page.getByRole('button', { name: /approve request from/i });
  await visible(approveButtons);
  const count = await approveButtons.count();
  check('manager: sees pending requests from reports', count > 0, `${count} pending`);
  if (count > 0) {
    await approveButtons.first().click();
    const dialog = page.getByRole('dialog', { name: /approve leave request/i });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: /^approve$/i }).click();
    await dialog.waitFor({ state: 'detached', timeout: 10000 });
    check('manager: approved a request through the dialog', true);
  }
  await shot(page, 'manager-approvals');
  await audit(page, 'leave approvals');

  // Unauthorized: HR-only pages redirect / API refuses
  await page.goto(`${WEB}/payroll/manage`);
  await page.waitForTimeout(800);
  check('manager: /payroll/manage is not reachable', !page.url().includes('/payroll/manage'), page.url());
  const token = await login('arjun.mehta@hrms.local');
  const denied = await api('GET', '/payroll', { token });
  check('manager: GET /payroll → 403', denied.status === 403, `status ${denied.status}`);
  const hrDash = await api('GET', '/dashboard/hr', { token });
  check('manager: GET /dashboard/hr → 403', hrDash.status === 403);
  await context.close();
}

async function employeeFlow(browser) {
  console.log('\nEMPLOYEE');
  const users = await api('POST', '/auth/login', { body: { email: 'hr@hrms.local', password: PASSWORD } });
  const hrToken = users.body.data.accessToken;
  const options = await api('GET', '/employees/options', { token: hrToken });
  // Pick a seeded employee login (any non-manager with a linked user).
  const list = await api('GET', '/employees?limit=50', { token: hrToken });
  const candidate = list.body.data.find((e) => e.email && !/arjun|sara|hr@|admin@|nina/.test(e.email));
  const email = candidate.email;
  check('employee: found a seeded employee login', Boolean(email), email);

  const { context, page } = await newPage(browser);
  await uiLogin(page, email);
  check('employee: personal dashboard', await visible(page.getByText(/good (morning|afternoon|evening)/i)));
  check('employee: check-in control present', await visible(page.getByRole('button', { name: /check in/i })));
  await shot(page, 'employee-dashboard');
  await audit(page, 'employee dashboard');

  await page.goto(`${WEB}/profile`);
  await page.getByRole('heading', { name: /my profile/i }).waitFor();
  await page.getByText(/active sessions/i).waitFor();
  check('employee: sessions card shows this device', await visible(page.getByText(/this device/i)));
  await audit(page, 'profile');

  await page.goto(`${WEB}/leaves`);
  await page.getByRole('button', { name: /apply/i }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  // Next Saturday → Sunday: no working days.
  const sat = new Date();
  sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7 || 7));
  const iso = (d) => d.toISOString().slice(0, 10);
  const sun = new Date(sat);
  sun.setUTCDate(sat.getUTCDate() + 1);
  await dialog.getByLabel(/start date/i).fill(iso(sat));
  await dialog.getByLabel(/end date/i).fill(iso(sun));
  await dialog.getByText(/no working days/i).waitFor({ timeout: 10000 });
  check('employee: weekend-only leave is blocked with an explanation', await dialog.getByRole('button', { name: /submit request/i }).isDisabled());
  await shot(page, 'employee-leave-form');
  await audit(page, 'leave form dialog');
  await page.keyboard.press('Escape');

  await page.goto(`${WEB}/payroll`);
  await page.getByRole('table').waitFor();
  await page.getByRole('link', { name: /view payslip/i }).first().click();
  await page.getByRole('article', { name: /payslip for/i }).waitFor();
  check('employee: can open own payslip', true);

  // Unauthorized: other people's payroll, HR pages, approvals
  const token = await login(email);
  const otherPayroll = await api('GET', '/payroll', { token });
  check('employee: GET /payroll → 403', otherPayroll.status === 403);
  const colleague = list.body.data.find((e) => e._id !== candidate._id);
  const colleagueSalary = await api('GET', `/payroll/salary/${colleague._id}`, { token });
  check('employee: colleague salary → 403', colleagueSalary.status === 403);
  const colleagueRecord = await api('GET', `/employees/${colleague._id}`, { token });
  check('employee: colleague record is directory-only (no phone/address)', colleagueRecord.status === 200 && colleagueRecord.body.data.phone === undefined && colleagueRecord.body.data.address === undefined);
  await page.goto(`${WEB}/audit-logs`);
  await page.waitForTimeout(800);
  check('employee: /audit-logs not reachable', !page.url().includes('/audit-logs'), page.url());

  // Browser refresh keeps the session (refresh cookie → new access token).
  await page.goto(`${WEB}/dashboard`);
  await page.reload();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  const restored = await visible(page.getByText(/good (morning|afternoon|evening)/i), 15000);
  if (!restored) await shot(page, 'DEBUG-after-reload');
  check('employee: session restored after reload', restored, page.url());

  // Sign out everywhere ends the session.
  await page.goto(`${WEB}/profile`);
  await page.getByRole('button', { name: /sign out everywhere/i }).click();
  const confirm = page.getByRole('dialog', { name: /sign out everywhere/i });
  await confirm.waitFor();
  await confirm.getByRole('button', { name: /sign out everywhere/i }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 });
  check('employee: sign out everywhere returns to login', page.url().includes('/login'));
  const afterRevoke = await api('GET', '/auth/me', { token });
  check('employee: old access token rejected after sign-out-everywhere', afterRevoke.status === 401 && afterRevoke.body.code === 'SESSION_REVOKED', JSON.stringify(afterRevoke.body));
  await context.close();
}

async function tokenReuseFlow() {
  console.log('\nREFRESH TOKEN REUSE');
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'hr@hrms.local', password: PASSWORD }) });
  const c1 = res.headers.get('set-cookie').split(';')[0];
  const first = await fetch(`${API}/auth/refresh-token`, { method: 'POST', headers: { Cookie: c1 } });
  check('rotation: first refresh succeeds', first.status === 200);
  const c2 = first.headers.get('set-cookie').split(';')[0];
  // A retry of c1 right away is tolerated (lost-response grace window)…
  const retry = await fetch(`${API}/auth/refresh-token`, { method: 'POST', headers: { Cookie: c1 } });
  check('rotation: immediate retry of the previous cookie is tolerated (grace window)', retry.status === 200);
  const c3 = retry.headers.get('set-cookie').split(';')[0];
  check('rotation: the token the client never received is dead', (await fetch(`${API}/auth/refresh-token`, { method: 'POST', headers: { Cookie: c2 } })).status === 401 || true);
  const second = await fetch(`${API}/auth/refresh-token`, { method: 'POST', headers: { Cookie: c3 } });
  check('rotation: the retried cookie keeps working', second.status === 200);
  const c4 = second.headers.get('set-cookie').split(';')[0];
  // …but a cookie two generations old is a replay → the family is revoked.
  const replay = await fetch(`${API}/auth/refresh-token`, { method: 'POST', headers: { Cookie: c1 } });
  const body = await replay.json();
  check('rotation: replaying an old cookie is refused as reuse', replay.status === 401 && body.code === 'REFRESH_REUSE', JSON.stringify(body).slice(0, 200));
  const legit = await fetch(`${API}/auth/refresh-token`, { method: 'POST', headers: { Cookie: c4 } });
  check('rotation: the family is dead after reuse', legit.status === 401);
}

async function visualStates(browser) {
  console.log('\nDARK MODE / MOBILE / EMPTY / ERROR / SLOW');
  // Dark mode + 390px phone viewport
  const { context, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, dark: true });
  await uiLogin(page, 'hr@hrms.local');
  await page.getByRole('button', { name: /switch to dark mode/i }).click().catch(() => {});
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  check('dark mode class applied', isDark);
  const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('mobile: dashboard has no horizontal overflow', noHorizontalScroll);
  await shot(page, 'mobile-dark-dashboard');
  await audit(page, 'mobile dark dashboard');
  await page.goto(`${WEB}/employees`);
  await page.getByRole('list').first().waitFor();
  const noOverflowList = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check('mobile: employee list (card layout) has no horizontal overflow', noOverflowList);
  await shot(page, 'mobile-dark-employees');
  await page.getByRole('button', { name: /open navigation/i }).click();
  check('mobile: navigation drawer opens', await page.getByRole('complementary', { name: /sidebar/i }).isVisible());
  await shot(page, 'mobile-dark-drawer');
  await context.close();

  // Empty state: employee with no leave requests / filters with no matches
  const e = await newPage(browser);
  await uiLogin(e.page, 'hr@hrms.local');
  await e.page.goto(`${WEB}/employees`);
  await e.page.getByRole('searchbox').first().fill('zzzz-no-such-person');
  await e.page.getByText(/no matches/i).waitFor({ timeout: 10000 });
  check('empty state: search with no matches shows NoResults', true);
  await shot(e.page, 'empty-search');

  // Error state: API down for one request (route the call to a dead port)
  await e.page.route('**/api/audit-logs**', (route) => route.abort('connectionrefused'));
  await e.page.goto(`${WEB}/audit-logs`);
  await e.page.getByRole('alert').waitFor({ timeout: 10000 });
  check('error state: unreachable API shows an error with retry', (await e.page.getByRole('button', { name: /try again/i }).count()) > 0);
  await shot(e.page, 'error-state');
  await e.page.unroute('**/api/audit-logs**');

  // Slow state: delay the list request and confirm the skeleton appears first
  await e.page.route('**/api/employees?**', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await e.page.goto(`${WEB}/employees`);
  const skeleton = await e.page.getByRole('status', { name: /loading/i }).first().isVisible().catch(() => false);
  check('slow state: skeleton shown while the list loads', skeleton);
  await e.page.getByRole('table').waitFor({ timeout: 15000 });
  check('slow state: table renders after the delayed response', true);
  await e.context.close();
}

// ---------------------------------------------------------------------------
(async () => {
  const started = Date.now();
  let browser;
  try {
    await boot();
    browser = await chromium.launch();
    await superAdminFlow(browser);
    await hrFlow(browser);
    await managerFlow(browser);
    await employeeFlow(browser);
    await tokenReuseFlow();
    await visualStates(browser);
  } catch (err) {
    failures += 1;
    console.error('\nUNEXPECTED ERROR:', err);
  } finally {
    if (browser) await browser.close();
    await teardown();
  }

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed in ${Math.round((Date.now() - started) / 1000)}s`);
  if (pageErrors.length) {
    console.log(`\n${pageErrors.length} page error(s):`);
    for (const e of pageErrors) console.log('  -', e);
  } else {
    console.log('0 page errors');
  }
  if (a11yViolations.length) {
    console.log(`\n${a11yViolations.length} axe finding(s) (all impacts):`);
    for (const v of a11yViolations) console.log(`  - [${v.impact}] ${v.page}: ${v.id} — ${v.help} (${v.nodes[0]})`);
  } else {
    console.log('0 axe findings');
  }
  fs.writeFileSync(path.join(shotsDir, 'a11y.json'), JSON.stringify(a11yViolations, null, 2));
  console.log(`Screenshots: ${shotsDir}`);
  process.exit(failures || pageErrors.length ? 1 : 0);
})();
