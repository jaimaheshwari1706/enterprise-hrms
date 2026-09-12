import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, UserPlus } from 'lucide-react';
import { employeeApi } from '../../api/employeeApi';
import { departmentApi } from '../../api/departmentApi';
import { designationApi } from '../../api/designationApi';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Button, Input, Select, FormField, Card, CardHeader, PageHeader, FormSkeleton, Alert, ErrorState, EmployeePicker } from '../../components/ui';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';
import { fullName, todayInputValue } from '../../utils/format';

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(30).optional(),
  dob: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other']),
  joiningDate: z.string().min(1, 'Joining date is required'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  manager: z.string().optional(),
  employmentType: z.enum(['Full-Time', 'Part-Time', 'Contract', 'Intern']),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR_ADMIN']).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressCity: z.string().trim().max(100).optional(),
  addressState: z.string().trim().max(100).optional(),
  addressCountry: z.string().trim().max(100).optional(),
  addressZip: z.string().trim().max(20).optional(),
});

const FIELD_MAP = {
  'address.line1': 'addressLine1',
  'address.city': 'addressCity',
  'address.state': 'addressState',
  'address.country': 'addressCountry',
  'address.zip': 'addressZip',
};

export default function EmployeeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { gender: 'Other', employmentType: 'Full-Time', role: 'EMPLOYEE', joiningDate: isEdit ? '' : todayInputValue() },
  });

  const selectedDepartment = watch('department');

  const departments = useApiQuery((signal) => departmentApi.list({ limit: 100, status: 'active', sort: 'name' }, { signal }), []);
  const designations = useApiQuery(
    (signal) => designationApi.list({ limit: 100, department: selectedDepartment, status: 'active', sort: 'name' }, { signal }),
    [selectedDepartment],
    { enabled: Boolean(selectedDepartment) }
  );
  const employee = useApiQuery((signal) => employeeApi.get(id, { signal }), [id], { enabled: isEdit });

  // Populate the form once the record arrives.
  useEffect(() => {
    if (!isEdit || !employee.data) return;
    const emp = employee.data;
    reset({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || '',
      dob: emp.dob ? emp.dob.slice(0, 10) : '',
      gender: emp.gender,
      joiningDate: emp.joiningDate ? emp.joiningDate.slice(0, 10) : '',
      department: emp.department?._id || emp.department,
      designation: emp.designation?._id || emp.designation,
      manager: emp.manager?._id || emp.manager || '',
      employmentType: emp.employmentType,
      addressLine1: emp.address?.line1 || '',
      addressCity: emp.address?.city || '',
      addressState: emp.address?.state || '',
      addressCountry: emp.address?.country || '',
      addressZip: emp.address?.zip || '',
    });
  }, [isEdit, employee.data, reset]);

  // The designation <select> is uncontrolled; when its options arrive after
  // reset() the browser shows the first option even though the form value
  // is correct. Re-apply the value once the list contains it.
  useEffect(() => {
    if (!designations.data) return;
    const current = watch('designation');
    if (current && designations.data.some((d) => d._id === current)) {
      setValue('designation', current, { shouldDirty: false });
    } else if (current && !designations.data.some((d) => d._id === current)) {
      setValue('designation', '', { shouldDirty: true });
    }
  }, [designations.data, setValue, watch]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    setServerError(null);
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone || '',
      dob: values.dob || '',
      gender: values.gender,
      joiningDate: values.joiningDate,
      department: values.department,
      designation: values.designation,
      manager: values.manager || null,
      employmentType: values.employmentType,
      address: {
        line1: values.addressLine1 || '',
        city: values.addressCity || '',
        state: values.addressState || '',
        country: values.addressCountry || '',
        zip: values.addressZip || '',
      },
    };

    try {
      if (isEdit) {
        await employeeApi.update(id, payload);
        showToast('Employee updated');
        navigate(`/employees/${id}`);
      } else {
        const { data } = await employeeApi.create({ ...payload, role: values.role });
        showToast({ title: 'Employee created', message: 'A login was provisioned and the temporary password has been sent by email.' });
        navigate(`/employees/${data.data._id}`);
      }
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err);
      let mapped = false;
      for (const [field, message] of Object.entries(fieldErrors)) {
        const name = FIELD_MAP[field] || field;
        if (name in values) {
          setError(name, { type: 'server', message });
          mapped = true;
        }
      }
      setServerError(mapped ? 'Please fix the highlighted fields.' : getApiErrorMessage(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const title = isEdit ? (employee.data ? `Edit ${fullName(employee.data)}` : 'Edit employee') : 'Add employee';
  const breadcrumb = [{ label: 'Employees', to: '/employees' }, ...(isEdit && employee.data ? [{ label: fullName(employee.data), to: `/employees/${id}` }] : []), { label: isEdit ? 'Edit' : 'New' }];

  if (isEdit && employee.status === 'loading') {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Edit employee" breadcrumb={breadcrumb} />
        <FormSkeleton />
      </div>
    );
  }
  if (isEdit && employee.status === 'error') {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Edit employee" breadcrumb={breadcrumb} />
        <Card>
          <ErrorState message={employee.error} onRetry={employee.refetch} />
        </Card>
      </div>
    );
  }

  const departmentOptions = departments.data || [];
  const designationOptions = designations.data || [];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={title}
        breadcrumb={breadcrumb}
        description={isEdit ? "Update this employee's information. Changing the email also updates their login." : 'A login is created automatically and the temporary password is emailed to the employee.'}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}

        <Card>
          <CardHeader title="Personal information" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FormField label="First name" required error={errors.firstName?.message}>
              <Input autoComplete="given-name" autoFocus={!isEdit} {...register('firstName')} />
            </FormField>
            <FormField label="Last name" required error={errors.lastName?.message}>
              <Input autoComplete="family-name" {...register('lastName')} />
            </FormField>
            <FormField label="Work email" required error={errors.email?.message} hint={isEdit ? undefined : 'Used to sign in'}>
              <Input type="email" autoComplete="email" placeholder="name@company.com" {...register('email')} />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <Input type="tel" autoComplete="tel" {...register('phone')} />
            </FormField>
            <FormField label="Date of birth" error={errors.dob?.message}>
              <Input type="date" max={todayInputValue()} {...register('dob')} />
            </FormField>
            <FormField label="Gender">
              <Select {...register('gender')}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other / prefer not to say</option>
              </Select>
            </FormField>
          </div>
        </Card>

        <Card>
          <CardHeader title="Job information" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FormField label="Joining date" required error={errors.joiningDate?.message}>
              <Input type="date" {...register('joiningDate')} />
            </FormField>
            <FormField label="Employment type" required>
              <Select {...register('employmentType')}>
                <option value="Full-Time">Full-time</option>
                <option value="Part-Time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
              </Select>
            </FormField>
            <FormField label="Department" required error={errors.department?.message}>
              <Select {...register('department')}>
                <option value="">Select department</option>
                {departmentOptions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Designation"
              required
              error={errors.designation?.message}
              hint={selectedDepartment && designations.status === 'ready' && designationOptions.length === 0 ? 'This department has no active designations yet.' : undefined}
            >
              <Select {...register('designation')} disabled={!selectedDepartment || designations.isFetching}>
                <option value="">{!selectedDepartment ? 'Select a department first' : designations.isFetching ? 'Loading…' : 'Select designation'}</option>
                {designationOptions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Reports to" error={errors.manager?.message} hint="Their manager approves leave requests; leave empty and HR approves instead">
              <EmployeePicker
                value={watch('manager') || ''}
                selected={isEdit ? employee.data?.manager : null}
                exclude={id ? [id] : []}
                emptyLabel="No manager"
                onChange={(managerId) => setValue('manager', managerId, { shouldDirty: true, shouldValidate: true })}
              />
            </FormField>
            {!isEdit && (
              <FormField label="Account role" required hint="Controls what they can see and do">
                <Select {...register('role')}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="HR_ADMIN">HR Admin</option>
                </Select>
              </FormField>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Address" description="Optional" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FormField label="Address line 1" className="sm:col-span-2" error={errors.addressLine1?.message}>
              <Input autoComplete="address-line1" {...register('addressLine1')} />
            </FormField>
            <FormField label="City" error={errors.addressCity?.message}>
              <Input autoComplete="address-level2" {...register('addressCity')} />
            </FormField>
            <FormField label="State" error={errors.addressState?.message}>
              <Input autoComplete="address-level1" {...register('addressState')} />
            </FormField>
            <FormField label="Country" error={errors.addressCountry?.message}>
              <Input autoComplete="country-name" {...register('addressCountry')} />
            </FormField>
            <FormField label="ZIP / Postal code" error={errors.addressZip?.message}>
              <Input autoComplete="postal-code" {...register('addressZip')} />
            </FormField>
          </div>
        </Card>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-slate-800 dark:bg-slate-950/95">
          <Button variant="secondary" type="button" onClick={() => navigate(isEdit ? `/employees/${id}` : '/employees')} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} icon={isEdit ? Save : UserPlus} disabled={isEdit && !isDirty}>
            {isEdit ? 'Save changes' : 'Create employee'}
          </Button>
        </div>
      </form>
    </div>
  );
}
