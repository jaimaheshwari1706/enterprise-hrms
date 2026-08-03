import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { employeeApi } from '../../api/employeeApi';
import { departmentApi } from '../../api/departmentApi';
import { designationApi } from '../../api/designationApi';
import { useToast } from '../../hooks/useToast';
import Button from '../../components/Button';
import { Loading } from '../../components/StateViews';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(['Male', 'Female', 'Other']),
  joiningDate: z.string().min(1, 'Joining date is required'),
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  manager: z.string().optional(),
  employmentType: z.enum(['Full-Time', 'Part-Time', 'Contract', 'Intern']),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR_ADMIN']).optional(),
  addressLine1: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressCountry: z.string().optional(),
  addressZip: z.string().optional(),
});

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function EmployeeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employees, setEmployees] = useState([]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { gender: 'Other', employmentType: 'Full-Time', role: 'EMPLOYEE' },
  });

  const selectedDepartment = watch('department');

  useEffect(() => {
    departmentApi.list({ limit: 100, status: 'active' }).then(({ data }) => setDepartments(data.data));
    employeeApi.list({ limit: 200, status: 'active' }).then(({ data }) => setEmployees(data.data));
  }, []);

  useEffect(() => {
    if (!selectedDepartment) {
      setDesignations([]);
      return;
    }
    designationApi
      .list({ limit: 100, department: selectedDepartment, status: 'active' })
      .then(({ data }) => setDesignations(data.data));
  }, [selectedDepartment]);

  useEffect(() => {
    if (!isEdit) return;
    employeeApi
      .get(id)
      .then(({ data }) => {
        const emp = data.data;
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
      })
      .catch(() => showToast('Failed to load employee', 'error'))
      .finally(() => setLoading(false));
  }, [id, isEdit, reset, showToast]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      dob: values.dob || undefined,
      gender: values.gender,
      joiningDate: values.joiningDate,
      department: values.department,
      designation: values.designation,
      manager: values.manager || null,
      employmentType: values.employmentType,
      address: {
        line1: values.addressLine1,
        city: values.addressCity,
        state: values.addressState,
        country: values.addressCountry,
        zip: values.addressZip,
      },
    };

    try {
      if (isEdit) {
        await employeeApi.update(id, payload);
        showToast('Employee updated successfully');
        navigate(`/employees/${id}`);
      } else {
        const { data } = await employeeApi.create({ ...payload, role: values.role });
        showToast('Employee created successfully. Login credentials have been emailed.');
        navigate(`/employees/${data.data._id}`);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading label="Loading employee…" />;

  return (
    <div className="max-w-3xl">
      <Link to="/employees" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
        <ArrowLeft size={15} /> Back to employees
      </Link>

      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">
        {isEdit ? 'Edit Employee' : 'Add Employee'}
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        {isEdit
          ? 'Update this employee\'s information.'
          : 'A login will be created automatically and credentials emailed to the employee.'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Personal Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First Name" error={errors.firstName?.message}>
              <input {...register('firstName')} className={inputClass} />
            </Field>
            <Field label="Last Name" error={errors.lastName?.message}>
              <input {...register('lastName')} className={inputClass} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register('email')} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input {...register('phone')} className={inputClass} />
            </Field>
            <Field label="Date of Birth">
              <input type="date" {...register('dob')} className={inputClass} />
            </Field>
            <Field label="Gender">
              <select {...register('gender')} className={inputClass}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Job Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Joining Date" error={errors.joiningDate?.message}>
              <input type="date" {...register('joiningDate')} className={inputClass} />
            </Field>
            <Field label="Employment Type">
              <select {...register('employmentType')} className={inputClass}>
                <option value="Full-Time">Full-Time</option>
                <option value="Part-Time">Part-Time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
              </select>
            </Field>
            <Field label="Department" error={errors.department?.message}>
              <select {...register('department')} className={inputClass}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Designation" error={errors.designation?.message}>
              <select {...register('designation')} className={inputClass} disabled={!selectedDepartment}>
                <option value="">
                  {selectedDepartment ? 'Select designation' : 'Select a department first'}
                </option>
                {designations.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Manager">
              <select {...register('manager')} className={inputClass}>
                <option value="">No manager</option>
                {employees
                  .filter((e) => e._id !== id)
                  .map((e) => (
                    <option key={e._id} value={e._id}>{e.firstName} {e.lastName} ({e.employeeId})</option>
                  ))}
              </select>
            </Field>
            {!isEdit && (
              <Field label="Account Role">
                <select {...register('role')} className={inputClass}>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="HR_ADMIN">HR Admin</option>
                </select>
              </Field>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Address</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Address Line 1">
              <input {...register('addressLine1')} className={inputClass} />
            </Field>
            <Field label="City">
              <input {...register('addressCity')} className={inputClass} />
            </Field>
            <Field label="State">
              <input {...register('addressState')} className={inputClass} />
            </Field>
            <Field label="Country">
              <input {...register('addressCountry')} className={inputClass} />
            </Field>
            <Field label="ZIP / Postal Code">
              <input {...register('addressZip')} className={inputClass} />
            </Field>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create employee'}
          </Button>
        </div>
      </form>
    </div>
  );
}
