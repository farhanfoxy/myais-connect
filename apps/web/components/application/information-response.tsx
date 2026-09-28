'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileText, LoaderCircle, LockKeyhole, UploadCloud } from 'lucide-react';
import { PageContainer, PageHeading, StatusBadge } from '@/components/dashboard/dashboard-ui';
import { Button } from '@/components/ui/button';
import { ApiError, type MembershipApplicationSummary } from '@/lib/api-client';
import {
  InformationAttachmentError, uploadInformationAttachment, validateInformationAttachment,
} from '@/lib/information-response-upload';
import { createMemberApiClient } from '@/lib/member-api';
import { statusLabel, statusTone } from '@/lib/member-status';
import { cn } from '@/lib/utils';

type SubmissionStage = 'authorizing' | 'uploading' | 'submitting';

function formattedDate(value: string | null | undefined): string {
  if (!value) return 'Not specified';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(new Date(value));
}

export function InformationResponse() {
  const router = useRouter();
  const api = useMemo(() => createMemberApiClient(), []);
  const [application, setApplication] = useState<MembershipApplicationSummary | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [response, setResponse] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [stage, setStage] = useState<SubmissionStage | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(() => {
    setLoadError(false); setApplication(undefined);
    api.listApplications().then(applications => {
      const latest = applications[0] ?? null;
      setApplication(latest);
      setSelectedId(latest?.openInformationRequests[0]?.id ?? '');
    }).catch(() => { setLoadError(true); setApplication(null); });
  }, [api]);
  useEffect(() => {
    let active = true;
    api.listApplications().then(applications => {
      if (!active) return;
      const latest = applications[0] ?? null;
      setApplication(latest);
      setSelectedId(latest?.openInformationRequests[0]?.id ?? '');
    }).catch(() => { if (active) { setLoadError(true); setApplication(null); } });
    return () => { active = false; };
  }, [api]);

  const requests = application?.openInformationRequests ?? [];
  const selected = requests.find(request => request.id === selectedId) ?? requests[0];
  const canRespond = application?.status === 'ADDITIONAL_INFORMATION_REQUIRED' && Boolean(selected);

  function chooseRequest(id: string) {
    if (stage) return;
    setSelectedId(id); setResponse(''); setFile(null); setFileError(''); setSubmitError('');
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFileError(''); setFile(next);
    if (!next) return;
    try { validateInformationAttachment(next); } catch (error) {
      setFile(null);
      setFileError(error instanceof InformationAttachmentError ? error.message : 'Choose a valid attachment.');
    }
    event.target.value = '';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application || !selected || !canRespond || stage) return;
    const cleanResponse = response.trim();
    if (!cleanResponse) { setSubmitError('Enter a response before submitting.'); return; }
    setSubmitError('');
    try {
      let attachmentUploadToken: string | undefined;
      if (file) {
        attachmentUploadToken = await uploadInformationAttachment(api, application.id, selected.id, file, fetch,
          next => setStage(next));
      }
      setStage('submitting');
      await api.respondToInformationRequest(application.id, selected.id, {
        response: cleanResponse, ...(attachmentUploadToken ? { attachmentUploadToken } : {}),
      });
      setSubmitted(true);
      router.replace('/my-application/tracker');
    } catch (error) {
      setStage(null);
      if (error instanceof InformationAttachmentError) setSubmitError(error.message);
      else if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        setSubmitError('This request is no longer available for a response. Return to the tracker for the latest status.');
      } else setSubmitError('We could not submit your response. Your text is still here; please try again.');
    }
  }

  return <PageContainer className="information-response-page">
    <PageHeading eyebrow="Membership" title="Respond to information request"
      description="Send the committee the requested details through the secure MyAIS workflow." />
    {application === undefined && <div className="application-loading" role="status"><Clock3 className="spin" /> Loading request…</div>}
    {loadError && <div className="application-load-error" role="alert"><AlertCircle />We could not load the information request.
      <button onClick={load}>Try again</button></div>}
    {!loadError && application !== undefined && !canRespond && <section className="tracker-empty-state"><span><CheckCircle2 /></span><div>
      <h2>No response required</h2><p>There are no open information requests available in the current application state.</p></div>
      <Link className="button button-secondary" href="/my-application/tracker"><ArrowLeft size={17} /> Application tracker</Link></section>}
    {application && canRespond && selected && <>
      <section className="response-application-context"><div><p>Application</p><strong>{application.applicationNumber || 'Draft application'}</strong></div>
        <StatusBadge tone={statusTone(application.status)}>{statusLabel(application.status)}</StatusBadge></section>
      {requests.length > 1 && <section className="response-request-picker" aria-labelledby="request-picker-heading">
        <header><h2 id="request-picker-heading">Open requests</h2><p>Choose one request to answer. Each response is submitted separately.</p></header>
        <div>{requests.map((request, index) => <button type="button" aria-pressed={request.id === selected.id}
          className={request.id === selected.id ? 'is-selected' : ''} onClick={() => chooseRequest(request.id)} key={request.id}>
          <span>Request {index + 1}</span><strong>{request.message}</strong><small>{formattedDate(request.createdAt)}</small></button>)}</div>
      </section>}
      <section className="response-panel"><header><span><AlertCircle /></span><div><p>Information requested</p>
        <h2>{selected.requestedByName || 'MyAIS Committee'}</h2></div></header>
        <div className="response-request-message"><p>{selected.message}</p><dl>
          <div><dt><CalendarDays /> Requested</dt><dd>{formattedDate(selected.createdAt)}</dd></div>
          <div><dt><CalendarDays /> Due date</dt><dd>{formattedDate(selected.dueDate)}</dd></div></dl></div>
        <form onSubmit={submit} noValidate><label className="response-text-field"><span>Your response <strong>Required</strong></span>
          <textarea value={response} onChange={event => setResponse(event.target.value)} rows={7}
            aria-invalid={Boolean(submitError && !response.trim())} disabled={Boolean(stage)}
            placeholder="Provide the requested information clearly…" /></label>
          <div className="response-attachment"><div><span>Supporting attachment <small>Optional</small></span>
            <p>PDF, JPEG, JPG or PNG · Maximum 5 MiB</p></div>
            <label className={cn('response-upload-control', stage && 'is-disabled')}>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={chooseFile} disabled={Boolean(stage)} />
              <UploadCloud size={18} />{file ? 'Replace attachment' : 'Choose attachment'}</label>
            {file && <div className="response-selected-file"><FileText /><span><strong>{file.name}</strong>
              <small>{Math.max(1, Math.round(file.size / 1024))} KB · Ready for private upload</small></span>
              <button type="button" onClick={() => setFile(null)} disabled={Boolean(stage)}>Remove</button></div>}
            {fileError && <p className="upload-error" role="alert">{fileError}</p>}
          </div>
          <div className="private-storage-note"><LockKeyhole size={16} />Your optional attachment is uploaded privately and scoped to this request.</div>
          {submitError && <div className="submission-error" role="alert"><AlertCircle />{submitError}</div>}
          <div className="response-form-actions"><Link href="/my-application/tracker"><ArrowLeft size={16} /> Back to tracker</Link>
            <Button type="submit" disabled={Boolean(stage) || !response.trim()}>{stage ? <><LoaderCircle className="spin" />
              {stage === 'authorizing' ? 'Securing upload…' : stage === 'uploading' ? 'Uploading…' : 'Submitting…'}</> : 'Submit response'}</Button></div>
          <p className="sr-only" aria-live="polite">{submitted ? 'Response submitted. Returning to the application tracker.' :
            stage ? 'Response submission in progress.' : ''}</p>
        </form>
      </section>
    </>}
  </PageContainer>;
}
