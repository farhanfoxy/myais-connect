'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { memberProfileInputSchema } from '@myais/validation';
import { BadgeCheck, BriefcaseBusiness, MapPin, Save, UploadCloud, UserRound, UsersRound } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { PageContainer, PageHeading } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import { Feedback } from '@/components/ui/feedback';
import { Spinner } from '@/components/ui/spinner';
import { UserAvatar } from '@/components/ui/user-avatar';
import type { MemberProfileFields, MemberProfileResponse } from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { profilePhotoAccept, uploadProfilePhoto, validateProfilePhoto } from '@/lib/profile-photo-upload';

type FormState = {
  fullName: string; identificationType: '' | 'NRIC' | 'PASSPORT' | 'OTHER'; identificationNumber: string;
  nationality: string; dateOfBirth: string; gender: '' | 'MALE' | 'FEMALE' | 'OTHER'; phoneNumber: string;
  addressLine1: string; addressLine2: string; city: string; state: string; postcode: string; country: string;
  institution: string; occupation: string; department: string; areaOfExpertise: string; aisMember: boolean;
  aisMembershipNumber: string; aisMembershipExpiry: string;
};

const blankForm: FormState = {
  fullName: '', identificationType: '', identificationNumber: '', nationality: '', dateOfBirth: '', gender: '',
  phoneNumber: '', addressLine1: '', addressLine2: '', city: '', state: '', postcode: '', country: '',
  institution: '', occupation: '', department: '', areaOfExpertise: '', aisMember: false,
  aisMembershipNumber: '', aisMembershipExpiry: '',
};

function toForm(profile: MemberProfileFields): FormState {
  return {
    fullName: profile.fullName ?? '', identificationType: profile.identificationType ?? '',
    identificationNumber: profile.identificationNumber ?? '', nationality: profile.nationality ?? '',
    dateOfBirth: profile.dateOfBirth ?? '', gender: profile.gender ?? '', phoneNumber: profile.phoneNumber ?? '',
    addressLine1: profile.addressLine1 ?? '', addressLine2: profile.addressLine2 ?? '', city: profile.city ?? '',
    state: profile.state ?? '', postcode: profile.postcode ?? '', country: profile.country ?? '',
    institution: profile.institution ?? '', occupation: profile.occupation ?? '', department: profile.department ?? '',
    areaOfExpertise: profile.areaOfExpertise ?? '', aisMember: profile.aisMember,
    aisMembershipNumber: profile.aisMembershipNumber ?? '', aisMembershipExpiry: profile.aisMembershipExpiry ?? '',
  };
}

function Field({ label, error, optional, ...props }: Readonly<{
  label: string; error?: string; optional?: boolean;
} & InputHTMLAttributes<HTMLInputElement>>) {
  const id = props.id ?? props.name;
  return <label className="profile-field" htmlFor={id}><span>{label}{optional && <small>Optional</small>}</span>
    <input {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
    {error && <em id={`${id}-error`}>{error}</em>}</label>;
}

function SelectField({ label, error, children, ...props }: Readonly<{
  label: string; error?: string; children: React.ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>>) {
  const id = props.id ?? props.name;
  return <label className="profile-field" htmlFor={id}><span>{label}</span>
    <select {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
      {children}</select>{error && <em id={`${id}-error`}>{error}</em>}</label>;
}

function ProfileSection({ icon: Icon, title, description, children }: Readonly<{
  icon: typeof UserRound; title: string; description: string; children: React.ReactNode;
}>) {
  return <section className="profile-section"><header><span><Icon size={20} /></span><div><h2>{title}</h2><p>{description}</p></div></header>
    <div className="profile-fields">{children}</div></section>;
}

export default function ProfilePage() {
  const { state, refresh } = useAuth();
  const [response, setResponse] = useState<MemberProfileResponse | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoStage, setPhotoStage] = useState<'authorizing' | 'uploading' | 'finalizing' | null>(null);
  const [photoMessage, setPhotoMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const next = await createMemberApiClient().getProfile();
      setResponse(next); setForm(toForm(next.profile));
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let active = true;
    void createMemberApiClient().getProfile().then(next => {
      if (!active) return;
      setResponse(next); setForm(toForm(next.profile)); setLoadError(false);
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [state.status]);
  useEffect(() => {
    return () => { if (photoPreview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);
  if (state.status !== 'authenticated') return null;

  function setValue<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => { const next = { ...current }; delete next[key]; return next; });
    setSaveResult(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ...form,
      addressLine2: form.addressLine2 || null,
      aisMembershipNumber: form.aisMember ? form.aisMembershipNumber : null,
      aisMembershipExpiry: form.aisMember ? form.aisMembershipExpiry || null : null,
    };
    const parsed = memberProfileInputSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'form');
        if (!next[field]) next[field] = issue.message;
      }
      setErrors(next); setSaveResult(null);
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setSaving(true); setSaveResult(null);
    try {
      const saved = await createMemberApiClient().updateProfile(parsed.data);
      setResponse(saved); setForm(toForm(saved.profile)); setErrors({}); setSaveResult('success');
      await refresh();
    } catch { setSaveResult('error'); }
    finally { setSaving(false); }
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    setPhotoMessage(null);
    if (!file) return;
    const validationError = validateProfilePhoto(file);
    if (validationError) { setPhotoFile(null); setPhotoPreview(null); setPhotoMessage({ tone: 'error', text: validationError }); return; }
    let preview: string | null = null;
    try { if (typeof URL.createObjectURL === 'function') preview = URL.createObjectURL(file); } catch { /* Preview is optional. */ }
    setPhotoPreview(preview); setPhotoFile(file);
  }

  async function savePhoto() {
    if (!photoFile || photoStage) return;
    setPhotoMessage(null);
    try {
      const next = await uploadProfilePhoto(createMemberApiClient(), photoFile, fetch, setPhotoStage);
      setResponse(next); setPhotoFile(null); setPhotoPreview(null); setPhotoStage(null);
      setPhotoMessage({ tone: 'success', text: 'Profile photo updated.' });
      await refresh();
    } catch {
      setPhotoStage(null); setPhotoFile(null); setPhotoPreview(null);
      setPhotoMessage({ tone: 'error', text: 'We could not update your profile photo. Your current photo is unchanged.' });
    }
  }

  if (loading) return <PageContainer className="profile-page"><div className="profile-loading" role="status">
    <Spinner /> Loading your profile…</div></PageContainer>;
  if (loadError || !response) return <PageContainer className="profile-page"><PageHeading eyebrow="Member profile"
    title="Profile" description="Manage the information used for your membership journey." />
    <Feedback>We could not load your profile. <button className="inline-retry" onClick={() => void load()}>Try again</button></Feedback>
  </PageContainer>;

  const completion = response.profile.profileCompletionPercentage;
  const avatarName = form.fullName || response.email;

  return <PageContainer className="profile-page">
    <PageHeading eyebrow="Member profile" title="Profile"
      description="Keep your personal and professional information accurate for membership applications." />
    <section className="profile-overview">
      <div className="profile-identity"><UserAvatar className="profile-avatar" photoUrl={photoPreview || response.photoUrl}
        name={avatarName} /><div className="profile-identity-copy">
        <h2>{form.fullName || 'Complete your profile'}</h2><p>{response.email}</p>
        <div className="profile-photo-controls"><label className="button button-secondary" aria-disabled={Boolean(photoStage)}>
          <UploadCloud size={15} />{response.photoUrl ? 'Change photo' : 'Upload photo'}
          <input type="file" accept={profilePhotoAccept} disabled={Boolean(photoStage)} onChange={choosePhoto} /></label>
          {photoFile && <Button type="button" disabled={Boolean(photoStage)} onClick={() => void savePhoto()}>
            {photoStage ? <><Spinner /> Uploadingâ€¦</> : 'Save photo'}</Button>}</div>
        <span>JPEG, PNG or WebP Â· Maximum 5 MB</span>
        <div className="profile-photo-feedback" aria-live="polite">{photoMessage &&
          <span className={photoMessage.tone === 'success' ? 'save-success' : 'save-error'}>{photoMessage.text}</span>}</div>
      </div></div>
      <div className="profile-completion"><div><span>Profile completeness</span><strong>{completion}%</strong></div>
        <div className="completion-track" role="progressbar" aria-label="Profile completeness" aria-valuemin={0}
          aria-valuemax={100} aria-valuenow={completion}><i style={{ width: `${completion}%` }} /></div>
        <p>{completion === 100 ? 'Your profile contains all required application information.' :
          'Complete all required fields before starting a membership application.'}</p></div>
    </section>

    <form className="profile-form" noValidate onSubmit={submit}>
      <ProfileSection icon={UserRound} title="Personal details" description="Your identity and contact information.">
        <Field name="fullName" label="Full name" autoComplete="name" value={form.fullName}
          onChange={event => setValue('fullName', event.target.value)} error={errors.fullName} />
        <Field name="email" label="Email" type="email" value={response.email} readOnly aria-readonly="true" />
        <SelectField name="identificationType" label="Identification type" value={form.identificationType}
          onChange={event => setValue('identificationType', event.target.value as FormState['identificationType'])}
          error={errors.identificationType}><option value="">Select identification type</option><option value="NRIC">NRIC</option>
          <option value="PASSPORT">Passport</option><option value="OTHER">Other</option></SelectField>
        <Field name="identificationNumber" label="Identification number" value={form.identificationNumber}
          onChange={event => setValue('identificationNumber', event.target.value)} error={errors.identificationNumber} />
        <Field name="nationality" label="Nationality" autoComplete="country-name" value={form.nationality}
          onChange={event => setValue('nationality', event.target.value)} error={errors.nationality} />
        <Field name="dateOfBirth" label="Date of birth" type="date" value={form.dateOfBirth}
          onChange={event => setValue('dateOfBirth', event.target.value)} error={errors.dateOfBirth} />
        <SelectField name="gender" label="Gender" value={form.gender}
          onChange={event => setValue('gender', event.target.value as FormState['gender'])} error={errors.gender}>
          <option value="">Select gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option>
          <option value="OTHER">Other</option></SelectField>
        <Field name="phoneNumber" label="Phone number" type="tel" autoComplete="tel" value={form.phoneNumber}
          onChange={event => setValue('phoneNumber', event.target.value)} error={errors.phoneNumber} />
      </ProfileSection>

      <ProfileSection icon={MapPin} title="Address" description="Your current residential or correspondence address.">
        <Field className="profile-field-wide" name="addressLine1" label="Address line 1" autoComplete="address-line1"
          value={form.addressLine1} onChange={event => setValue('addressLine1', event.target.value)} error={errors.addressLine1} />
        <Field className="profile-field-wide" name="addressLine2" label="Address line 2" optional autoComplete="address-line2"
          value={form.addressLine2} onChange={event => setValue('addressLine2', event.target.value)} error={errors.addressLine2} />
        <Field name="city" label="City" autoComplete="address-level2" value={form.city}
          onChange={event => setValue('city', event.target.value)} error={errors.city} />
        <Field name="state" label="State" autoComplete="address-level1" value={form.state}
          onChange={event => setValue('state', event.target.value)} error={errors.state} />
        <Field name="postcode" label="Postcode" autoComplete="postal-code" value={form.postcode}
          onChange={event => setValue('postcode', event.target.value)} error={errors.postcode} />
        <Field name="country" label="Country" autoComplete="country-name" value={form.country}
          onChange={event => setValue('country', event.target.value)} error={errors.country} />
      </ProfileSection>

      <ProfileSection icon={BriefcaseBusiness} title="Professional information" description="Your current professional affiliation.">
        <Field name="institution" label="Institution" value={form.institution}
          onChange={event => setValue('institution', event.target.value)} error={errors.institution} />
        <Field name="occupation" label="Occupation" value={form.occupation}
          onChange={event => setValue('occupation', event.target.value)} error={errors.occupation} />
        <Field name="department" label="Department" value={form.department}
          onChange={event => setValue('department', event.target.value)} error={errors.department} />
        <Field name="areaOfExpertise" label="Area of expertise" value={form.areaOfExpertise}
          onChange={event => setValue('areaOfExpertise', event.target.value)} error={errors.areaOfExpertise} />
      </ProfileSection>

      <ProfileSection icon={UsersRound} title="AIS membership" description="Your Association for Information Systems membership details.">
        <label className="ais-member-toggle"><input type="checkbox" checked={form.aisMember}
          onChange={event => setValue('aisMember', event.target.checked)} /><span><strong>I am an AIS member</strong>
          <small>Add your membership number and current expiry date.</small></span></label>
        {form.aisMember && <><Field name="aisMembershipNumber" label="AIS membership number"
          value={form.aisMembershipNumber} onChange={event => setValue('aisMembershipNumber', event.target.value)}
          error={errors.aisMembershipNumber} /><Field name="aisMembershipExpiry" label="AIS membership expiry" type="date"
          value={form.aisMembershipExpiry} onChange={event => setValue('aisMembershipExpiry', event.target.value)}
          error={errors.aisMembershipExpiry} /></>}
      </ProfileSection>

      <div className="profile-save-bar"><div aria-live="polite">{saveResult === 'success' && <span className="save-success">
        <BadgeCheck size={18} /> Profile saved successfully.</span>}{saveResult === 'error' && <span className="save-error">
        We could not save your profile. Your changes are still here.</span>}</div>
        <Button type="submit" disabled={saving}>{saving ? <><Spinner /> Saving…</> : <><Save size={17} /> Save profile</>}</Button></div>
    </form>
  </PageContainer>;
}
