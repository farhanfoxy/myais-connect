'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCircle2, Clock3,
  Download, FileCheck2, FileImage, FileText, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck,
  Trash2, UploadCloud, UserRound,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import type {
  ApplicationDocument, ApplicationDocumentType, EligibilityInput, EligibilityResult,
  MemberProfileResponse, MembershipApplicationSummary, MembershipTypeOption,
} from '@/lib/api-client';
import { createMemberApiClient } from '@/lib/member-api';
import { statusLabel, statusTone } from '@/lib/member-status';
import { ApplicationUploadError, uploadApplicationDocument } from '@/lib/application-upload';
import { cn } from '@/lib/utils';

type WizardStep = 1 | 2 | 3 | 4;
type UploadStage = 'authorizing' | 'uploading' | 'finalizing';

interface EligibilityForm {
  malaysianCitizen: boolean;
  dateOfBirth: string;
  residingInMalaysia: boolean;
  aisMember: boolean;
  aisNumber: string;
  aisExpiry: string;
}

const steps: Array<{ number: WizardStep; label: string }> = [
  { number: 1, label: 'Eligibility' }, { number: 2, label: 'Membership type' },
  { number: 3, label: 'Documents' }, { number: 4, label: 'Review & submit' },
];

const documentRequirements: Array<{
  type: ApplicationDocumentType; label: string; description: string; required: boolean;
}> = [
  { type: 'IDENTIFICATION', label: 'Identification', description: 'NRIC, passport or other identification document.', required: true },
  { type: 'AIS_MEMBERSHIP_PROOF', label: 'AIS membership proof',
    description: 'Required for every application under the existing membership process.', required: true },
  { type: 'PROFILE_PHOTO', label: 'Profile photo', description: 'A clear recent profile photograph.', required: true },
  { type: 'ADDITIONAL_SUPPORTING_DOCUMENT', label: 'Additional supporting document',
    description: 'Optional supporting evidence relevant to your application.', required: false },
];

const terminalStatuses = new Set(['ACTIVE', 'REJECTED', 'SUSPENDED', 'EXPIRED', 'TERMINATED']);

function eligibilityFromProfile(profile: MemberProfileResponse): EligibilityForm {
  return {
    malaysianCitizen: Boolean(profile.profile.nationality?.toLowerCase().includes('malaysia')),
    dateOfBirth: profile.profile.dateOfBirth ?? '',
    residingInMalaysia: Boolean(profile.profile.country?.toLowerCase().includes('malaysia')),
    aisMember: profile.profile.aisMember,
    aisNumber: profile.profile.aisMembershipNumber ?? '',
    aisExpiry: profile.profile.aisMembershipExpiry ?? '',
  };
}

export function eligibilityPayload(form: EligibilityForm): EligibilityInput {
  return {
    malaysianCitizen: form.malaysianCitizen,
    ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
    residingInMalaysia: form.residingInMalaysia,
    aisMember: form.aisMember,
    ...(form.aisMember && form.aisNumber.trim() ? { aisNumber: form.aisNumber.trim() } : {}),
    ...(form.aisMember && form.aisExpiry ? { aisExpiry: form.aisExpiry } : {}),
  };
}

function money(value: string | null): string {
  if (value === null) return 'Not specified';
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(value));
}

function fileSize(value: number | null): string {
  if (!value) return 'Size unavailable';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function dateTime(value: string | null): string {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function WizardProgress({ current }: Readonly<{ current: WizardStep }>) {
  return <nav className="application-steps" aria-label="Application progress">
    <p><span>Step {current} of 4</span><strong>{steps[current - 1]?.label}</strong></p>
    <ol>{steps.map(step => <li className={cn(step.number === current && 'is-current', step.number < current && 'is-complete')}
      key={step.number} aria-current={step.number === current ? 'step' : undefined}><span>{step.number < current ? <Check size={14} /> : step.number}</span>
      <strong>{step.label}</strong></li>)}</ol>
  </nav>;
}

function ProfileRequirement({ profile }: Readonly<{ profile: MemberProfileResponse }>) {
  if (profile.profile.profileCompletionPercentage === 100) return null;
  return <div className="application-guidance" role="note"><AlertCircle size={20} /><div><strong>Complete your profile before submitting</strong>
    <p>Your profile is {profile.profile.profileCompletionPercentage}% complete. You may check eligibility now, but submission requires a complete profile.</p></div>
    <Link href="/profile">Complete profile <ArrowRight size={15} /></Link></div>;
}

function EligibilityStep({ form, setForm, submit, loading, result }: Readonly<{
  form: EligibilityForm; setForm(next: EligibilityForm): void; submit(event: FormEvent<HTMLFormElement>): void;
  loading: boolean; result: EligibilityResult | null;
}>) {
  return <section className="wizard-panel"><header className="wizard-panel-heading"><span><ShieldCheck /></span><div>
    <p>Step 1</p><h2>Check your eligibility</h2><small>The MyAIS API evaluates your profile and these answers securely.</small>
  </div></header><form className="eligibility-form" onSubmit={submit}>
    <div className="eligibility-choice-grid">
      <BooleanChoice label="Malaysian citizen" checked={form.malaysianCitizen}
        onChange={value => setForm({ ...form, malaysianCitizen: value })} />
      <BooleanChoice label="Currently residing in Malaysia" checked={form.residingInMalaysia}
        onChange={value => setForm({ ...form, residingInMalaysia: value })} />
      <BooleanChoice label="Current AIS member" checked={form.aisMember}
        onChange={value => setForm({ ...form, aisMember: value })} />
    </div>
    <div className="eligibility-fields"><label><span>Date of birth</span><input type="date" value={form.dateOfBirth}
      onChange={event => setForm({ ...form, dateOfBirth: event.target.value })} /></label>
      {form.aisMember && <><label><span>AIS membership number</span><input value={form.aisNumber}
        onChange={event => setForm({ ...form, aisNumber: event.target.value })} /></label>
        <label><span>AIS membership expiry</span><input type="date" value={form.aisExpiry}
          onChange={event => setForm({ ...form, aisExpiry: event.target.value })} /></label></>}
    </div>
    <div className="wizard-actions"><span>Eligibility is calculated only by the server.</span><Button type="submit" disabled={loading}>
      {loading ? <><LoaderCircle className="spin" size={17} /> Checking…</> : <>Check eligibility <ArrowRight size={17} /></>}
    </Button></div>
  </form>{result && <EligibilityResultCard result={result} />}</section>;
}

function BooleanChoice({ label, checked, onChange }: Readonly<{ label: string; checked: boolean; onChange(value: boolean): void }>) {
  return <fieldset className="boolean-choice"><legend>{label}</legend><div><label className={checked ? 'is-selected' : ''}>
    <input type="radio" checked={checked} onChange={() => onChange(true)} /><span>Yes</span></label>
    <label className={!checked ? 'is-selected' : ''}><input type="radio" checked={!checked}
      onChange={() => onChange(false)} /><span>No</span></label></div></fieldset>;
}

function EligibilityResultCard({ result }: Readonly<{ result: EligibilityResult }>) {
  return <div className="eligibility-result" role="status"><span className="eligibility-score"><strong>{result.score}</strong><small>/ 100</small></span>
    <div><p>Server recommendation</p><h3>{result.recommendedTypeName}</h3><span>{result.explanation}</span></div>
    <BadgeCheck size={24} /></div>;
}

function MembershipTypeStep({ types, eligibility, selected, select, create, loading, back }: Readonly<{
  types: MembershipTypeOption[]; eligibility: EligibilityResult; selected: string | null; select(code: string): void;
  create(): void; loading: boolean; back(): void;
}>) {
  const visible = types.filter(type => eligibility.selectableTypeCodes.some(code => code === type.code));
  return <section className="wizard-panel"><header className="wizard-panel-heading"><span><BadgeCheck /></span><div><p>Step 2</p>
    <h2>Choose a membership type</h2><small>Only server-approved options for your eligibility result are shown.</small></div></header>
    <EligibilityResultCard result={eligibility} /><div className="membership-type-grid" role="radiogroup" aria-label="Membership type">
      {visible.map(type => <button type="button" role="radio" aria-checked={selected === type.code}
        className={cn('membership-type-card', selected === type.code && 'is-selected')} key={type.id}
        onClick={() => select(type.code)}><span className="type-selection">{selected === type.code ? <Check size={16} /> : null}</span>
        <p>{type.code === eligibility.recommendedTypeCode ? 'Recommended' : 'Available'}</p><h3>{type.name}</h3>
        {type.description && <span>{type.description}</span>}<dl><div><dt>Entrance fee</dt><dd>{money(type.entranceFee)}</dd></div>
          <div><dt>Membership fee</dt><dd>{money(type.membershipFee)}</dd></div></dl></button>)}</div>
    <div className="wizard-actions"><Button variant="secondary" onClick={back}><ArrowLeft size={17} /> Back</Button>
      <Button disabled={!selected || loading} onClick={create}>{loading ? <><LoaderCircle className="spin" size={17} /> Creating draft…</> :
        <>Continue to documents <ArrowRight size={17} /></>}</Button></div></section>;
}

function DocumentsStep({ documents, uploadStates, uploadErrors, onFile, onDelete, deleting,
  onDownload, downloading, next }: Readonly<{
    documents: ApplicationDocument[];
    uploadStates: Partial<Record<ApplicationDocumentType, UploadStage>>;
    uploadErrors: Partial<Record<ApplicationDocumentType, string>>;
    onFile(type: ApplicationDocumentType, event: ChangeEvent<HTMLInputElement>): void;
    onDelete(document: ApplicationDocument): void; deleting: string | null;
    onDownload(document: ApplicationDocument): void; downloading: string | null; next(): void;
  }>) {
  const missing = documentRequirements.filter(item => item.required && !documents.some(document => document.documentType === item.type));
  return <section className="wizard-panel"><header className="wizard-panel-heading"><span><UploadCloud /></span><div><p>Step 3</p>
    <h2>Upload supporting documents</h2><small>Files are sent through a short-lived private upload authorization.</small></div></header>
    <div className="private-storage-note"><LockKeyhole size={18} /><span>PDF, JPEG, JPG or PNG · Maximum 5 MB per file · Private access only</span></div>
    <div className="document-requirements">{documentRequirements.map(requirement => {
      const rows = documents.filter(document => document.documentType === requirement.type);
      const stage = uploadStates[requirement.type];
      return <article className="document-card" key={requirement.type}><header><span className="document-kind-icon">
        {requirement.type === 'PROFILE_PHOTO' ? <FileImage /> : <FileText />}</span><div><h3>{requirement.label}</h3>
        <p>{requirement.description}</p></div><StatusBadge tone={rows.length ? 'success' : requirement.required ? 'warning' : 'neutral'}>
          {rows.length ? `${rows.length} uploaded` : requirement.required ? 'Required' : 'Optional'}</StatusBadge></header>
        {rows.length > 0 && <ul className="document-list">{rows.map(document => <li key={document.id}><span><FileCheck2 size={18} /></span>
          <div><strong>{document.originalFileName ?? 'Legacy document'}</strong><small>{fileSize(document.fileSize)} · {statusLabel(document.verificationStatus)}</small></div>
          <div className="document-row-actions"><button type="button" disabled={!document.downloadAvailable || downloading === document.id}
            onClick={() => onDownload(document)} aria-label={`Download ${document.originalFileName ?? requirement.label}`}>
            {downloading === document.id ? <LoaderCircle className="spin" /> : <Download />}</button>
            <button type="button" disabled={deleting === document.id} onClick={() => onDelete(document)}
              aria-label={`Delete ${document.originalFileName ?? requirement.label}`}>
              {deleting === document.id ? <LoaderCircle className="spin" /> : <Trash2 />}</button></div></li>)}</ul>}
        <div className="document-upload-row"><label className={cn('document-upload-button', stage && 'is-loading')}>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={Boolean(stage)}
            onChange={event => onFile(requirement.type, event)} /><UploadCloud size={17} />
          <span>{stage === 'authorizing' ? 'Authorizing…' : stage === 'uploading' ? 'Uploading privately…' :
            stage === 'finalizing' ? 'Securing document…' : rows.length ? 'Add another file' : 'Choose file'}</span></label>
          {stage && <span className="upload-stage" role="status"><i className={`stage-${stage}`} />Private upload in progress</span>}
          {uploadErrors[requirement.type] && <span className="upload-error" role="alert">{uploadErrors[requirement.type]}</span>}</div>
      </article>;
    })}</div><div className="wizard-actions"><span>{missing.length ? `${missing.length} required document${missing.length === 1 ? '' : 's'} still missing.` :
      'All required document types are present.'}</span><Button onClick={next}>Review application <ArrowRight size={17} /></Button></div></section>;
}

function ReviewStep({ application, profile, documents, declaration, setDeclaration, back, submit, submitting, error }: Readonly<{
  application: MembershipApplicationSummary; profile: MemberProfileResponse; documents: ApplicationDocument[];
  declaration: boolean; setDeclaration(value: boolean): void; back(): void; submit(): void; submitting: boolean; error: string;
}>) {
  const missing = documentRequirements.filter(item => item.required && !documents.some(document => document.documentType === item.type));
  const profileComplete = profile.profile.profileCompletionPercentage === 100;
  return <section className="wizard-panel"><header className="wizard-panel-heading"><span><FileCheck2 /></span><div><p>Step 4</p>
    <h2>Review and submit</h2><small>Confirm your profile, membership choice and private documents.</small></div></header>
    <div className="review-grid"><section><h3><UserRound size={18} /> Applicant</h3><dl><div><dt>Name</dt><dd>{profile.profile.fullName ?? 'Not provided'}</dd></div>
      <div><dt>Email</dt><dd>{profile.email}</dd></div><div><dt>Profile completeness</dt><dd>{profile.profile.profileCompletionPercentage}%</dd></div></dl>
      {!profileComplete && <Link className="review-fix-link" href="/profile">Complete profile <ArrowRight size={14} /></Link>}</section>
      <section><h3><BadgeCheck size={18} /> Membership</h3><dl><div><dt>Requested type</dt>
        <dd>{application.requestedMembershipType?.name ?? application.requestedMembershipType?.code ?? 'Not selected'}</dd></div>
        <div><dt>Recommended type</dt><dd>{application.recommendedMembershipType?.name ?? application.recommendedMembershipType?.code ?? 'Not available'}</dd></div>
        <div><dt>Eligibility score</dt><dd>{application.eligibilityScore ?? 'Not available'}</dd></div></dl></section></div>
    <section className="review-documents"><h3><FileText size={18} /> Document checklist</h3>{documentRequirements.filter(item => item.required).map(item => {
      const count = documents.filter(document => document.documentType === item.type).length;
      return <div key={item.type} className={count ? 'is-complete' : 'is-missing'}><span>{count ? <Check size={15} /> : <AlertCircle size={15} />}</span>
        <strong>{item.label}</strong><small>{count ? `${count} file${count === 1 ? '' : 's'} uploaded` : 'Missing'}</small></div>;
    })}</section>
    <label className="application-declaration"><input type="checkbox" checked={declaration}
      onChange={event => setDeclaration(event.target.checked)} /><span><strong>I confirm that the information and documents provided are accurate.</strong>
      <small>This declaration is required before the server can accept your application.</small></span></label>
    {error && <div className="submission-error" role="alert"><AlertCircle size={18} />{error}</div>}
    <div className="wizard-actions"><Button variant="secondary" onClick={back}><ArrowLeft size={17} /> Back to documents</Button>
      <Button onClick={submit} disabled={!declaration || missing.length > 0 || !profileComplete || submitting}>
        {submitting ? <><LoaderCircle className="spin" size={17} /> Submitting…</> : <>Submit application <ArrowRight size={17} /></>}</Button></div></section>;
}

function ReadOnlyApplication({ application, historical = false }: Readonly<{
  application: MembershipApplicationSummary; historical?: boolean;
}>) {
  const submitted = application.status === 'SUBMITTED';
  return <section className="application-state-card"><span className="application-state-icon">
    {application.status === 'ACTIVE' ? <BadgeCheck /> : submitted ? <CheckCircle2 /> : <Clock3 />}</span>
    <div className="application-state-copy"><p>{historical ? 'Most recent application' : 'Current application'}</p>
      <h2>{statusLabel(application.status)}</h2><span>{stateDescription(application.status)}</span></div>
    <StatusBadge tone={statusTone(application.status)}>{statusLabel(application.status)}</StatusBadge>
    <dl><div><dt>Application reference</dt><dd>{application.applicationNumber ?? 'Pending submission'}</dd></div>
      <div><dt>Membership type</dt><dd>{application.requestedMembershipType?.name ?? application.requestedMembershipType?.code ?? 'Not available'}</dd></div>
      <div><dt>Submitted</dt><dd>{dateTime(application.submittedAt)}</dd></div></dl>
    {application.status === 'ADDITIONAL_INFORMATION_REQUIRED' && application.openInformationRequests[0] &&
      <div className="application-state-notice"><AlertCircle size={18} /><span><strong>Information has been requested</strong>
        <p>{application.openInformationRequests[0].message}</p></span></div>}
    {application.latestReviewerRemarks && application.latestReviewerRemarks !== application.rejectionReason &&
      <div className="application-state-notice"><AlertCircle size={18} /><span><strong>Reviewer note</strong>
        <p>{application.latestReviewerRemarks}</p></span></div>}
    {application.rejectionReason && <div className="application-state-notice is-danger"><AlertCircle size={18} /><span>
      <strong>Reason provided</strong><p>{application.rejectionReason}</p></span></div>}
    <div className="state-next-action"><span>{nextAction(application.status)}</span><Button disabled>Coming next</Button></div></section>;
}

function stateDescription(status: string): string {
  const descriptions: Record<string, string> = {
    SUBMITTED: 'Your application has been received and is waiting for committee review.',
    UNDER_REVIEW: 'The committee is currently reviewing your application.',
    ADDITIONAL_INFORMATION_REQUIRED: 'The committee needs additional information before continuing.',
    RECOMMENDED_FOR_APPROVAL: 'Your application has been recommended for final approval.',
    APPROVED_PENDING_PAYMENT: 'Your application is approved and awaiting payment.',
    PAYMENT_SUBMITTED: 'Your payment has been submitted for verification.',
    PAYMENT_UNDER_VERIFICATION: 'Your payment is being verified.', ACTIVE: 'Your membership is active.',
    REJECTED: 'This application was not approved.', SUSPENDED: 'Your membership is currently suspended.',
    EXPIRED: 'This application is no longer active.',
    TERMINATED: 'This application has been terminated.',
  };
  return descriptions[status] ?? 'Your application is available in read-only mode.';
}

function nextAction(status: string): string {
  if (status === 'APPROVED_PENDING_PAYMENT') return 'Payment submission will be available in the payment phase.';
  if (status === 'ADDITIONAL_INFORMATION_REQUIRED') return 'Information responses will be available in a later phase.';
  return 'Full application tracking will be available in a later phase.';
}

export function ApplicationWizard() {
  const { state } = useAuth();
  const [profile, setProfile] = useState<MemberProfileResponse | null>(null);
  const [types, setTypes] = useState<MembershipTypeOption[]>([]);
  const [application, setApplication] = useState<MembershipApplicationSummary | null>(null);
  const [historical, setHistorical] = useState(false);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [eligibilityForm, setEligibilityForm] = useState<EligibilityForm | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [pageError, setPageError] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [uploadStates, setUploadStates] = useState<Partial<Record<ApplicationDocumentType, UploadStage>>>({});
  const [uploadErrors, setUploadErrors] = useState<Partial<Record<ApplicationDocumentType, string>>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [declaration, setDeclaration] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let active = true;
    const api = createMemberApiClient();
    void Promise.all([api.getProfile(), api.listMembershipTypes(), api.getCurrentApplication(), api.listApplications()])
      .then(async ([nextProfile, nextTypes, current, history]) => {
        if (!active) return;
        const latest = current ?? history[0] ?? null;
        setProfile(nextProfile); setTypes(nextTypes); setEligibilityForm(eligibilityFromProfile(nextProfile));
        if (latest) {
          setApplication(latest); setHistorical(!current && terminalStatuses.has(latest.status));
          if (latest.status === 'DRAFT') {
            const nextDocuments = await api.listApplicationDocuments(latest.id);
            if (!active) return;
            setDocuments(nextDocuments); setStep(3); setHistorical(false);
          }
        }
      }).catch(() => { if (active) setPageError('We could not load your application information. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [state.status]);

  const draft = application?.status === 'DRAFT' ? application : null;
  const pageTitle = application && application.status !== 'DRAFT' ? 'Application status' : 'Membership application';
  const api = useMemo(() => state.status === 'authenticated' ? createMemberApiClient() : null, [state.status]);
  if (state.status !== 'authenticated') return null;
  if (loading) return <PageContainer className="application-page"><div className="application-loading" role="status">
    <LoaderCircle className="spin" /> Loading your application…</div></PageContainer>;
  if (!profile || !eligibilityForm || !api) return <PageContainer className="application-page">
    <PageHeading eyebrow="Membership" title="My application" description="Apply for MyAIS membership securely." />
    <div className="application-load-error" role="alert"><AlertCircle />{pageError || 'Application information is unavailable.'}
      <button onClick={() => window.location.reload()}><RefreshCw size={16} /> Reload</button></div></PageContainer>;
  const memberApi = api;
  const applicationProfile = profile;
  const currentEligibilityForm = eligibilityForm;
  if (application && application.status !== 'DRAFT') return <PageContainer className="application-page">
    <PageHeading eyebrow="Membership" title={pageTitle} description="Your latest MyAIS membership application." />
    <ReadOnlyApplication application={application} historical={historical} /></PageContainer>;

  async function evaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setPageError('');
    try { const result = await memberApi.evaluateEligibility(eligibilityPayload(currentEligibilityForm)); setEligibility(result); setStep(2); }
    catch { setPageError('We could not check eligibility right now. Please try again.'); }
    finally { setWorking(false); }
  }

  async function createDraft() {
    if (!eligibility || !selectedType) return;
    setWorking(true); setPageError('');
    try {
      const next = await memberApi.createApplicationDraft({ requestedMembershipTypeCode: selectedType,
        eligibility: eligibilityPayload(currentEligibilityForm) });
      setApplication(next); setDocuments(await memberApi.listApplicationDocuments(next.id)); setStep(3);
    } catch { setPageError('We could not create your application draft. Please review your selection and try again.'); }
    finally { setWorking(false); }
  }

  async function chooseFile(type: ApplicationDocumentType, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !draft) return;
    setUploadErrors(current => ({ ...current, [type]: undefined }));
    try {
      await uploadApplicationDocument(memberApi, draft.id, type, file, fetch,
        stage => setUploadStates(current => ({ ...current, [type]: stage })));
      setDocuments(await memberApi.listApplicationDocuments(draft.id));
    } catch (error) {
      setUploadErrors(current => ({ ...current, [type]: error instanceof ApplicationUploadError ? error.message :
        'We could not upload this document. Please try again.' }));
    } finally { setUploadStates(current => ({ ...current, [type]: undefined })); }
  }

  async function deleteDocument(document: ApplicationDocument) {
    if (!draft || !window.confirm(`Delete ${document.originalFileName ?? 'this document'}?`)) return;
    setDeleting(document.id);
    try { await memberApi.deleteApplicationDocument(draft.id, document.id); setDocuments(await memberApi.listApplicationDocuments(draft.id)); }
    catch { setPageError('We could not delete that document. It has not been removed from this list.'); }
    finally { setDeleting(null); }
  }

  async function downloadDocument(document: ApplicationDocument) {
    if (!draft || !document.downloadAvailable) return;
    setDownloading(document.id);
    try {
      const target = await memberApi.getApplicationDocumentDownload(draft.id, document.id);
      const opened = window.open(target.downloadUrl, '_blank', 'noopener,noreferrer');
      if (opened) opened.opener = null;
    } catch { setPageError('A private download is not available for that document.'); }
    finally { setDownloading(null); }
  }

  async function submit() {
    if (!draft || !declaration) return;
    setWorking(true); setSubmissionError('');
    try { setApplication(await memberApi.submitApplication(draft.id)); }
    catch { setSubmissionError('The server could not submit this application. Review your profile and documents, then try again.'); }
    finally { setWorking(false); }
  }

  return <PageContainer className="application-page"><PageHeading eyebrow="Membership" title="Membership application"
    description="Complete each step to submit your application securely." />
    <ProfileRequirement profile={applicationProfile} />
    {pageError && <div className="application-inline-error" role="alert"><AlertCircle size={17} />{pageError}</div>}
    <WizardProgress current={step} />
    {step === 1 && <EligibilityStep form={currentEligibilityForm} setForm={setEligibilityForm} submit={evaluate}
      loading={working} result={eligibility} />}
    {step === 2 && eligibility && <MembershipTypeStep types={types} eligibility={eligibility} selected={selectedType}
      select={setSelectedType} create={() => void createDraft()} loading={working} back={() => setStep(1)} />}
    {step === 3 && draft && <DocumentsStep documents={documents} uploadStates={uploadStates}
      uploadErrors={uploadErrors} onFile={(type, event) => void chooseFile(type, event)}
      onDelete={document => void deleteDocument(document)} deleting={deleting}
      onDownload={document => void downloadDocument(document)} downloading={downloading} next={() => setStep(4)} />}
    {step === 4 && draft && <ReviewStep application={draft} profile={applicationProfile} documents={documents}
      declaration={declaration} setDeclaration={setDeclaration} back={() => setStep(3)} submit={() => void submit()}
      submitting={working} error={submissionError} />}
  </PageContainer>;
}
