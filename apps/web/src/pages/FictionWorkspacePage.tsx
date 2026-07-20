import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BookOpen, CheckCircle2, Clock3, FilePenLine, Plus, Save, Send } from 'lucide-react';
import { ContentRating, type OwnerFictionDraft } from '@hasu-gallery/proto';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  FormMessage,
  Input,
  Select,
  Textarea,
  buttonStyles,
  cn,
} from '@hasu-gallery/ui';
import { createFiction, listOwnerFictions, saveFictionDraft, submitFiction } from '../api/fiction';
import { useI18n } from '../i18n';
import { fictionErrorKey, fictionStateKeys, isFictionState } from '../lib/fiction';

interface FictionFormState {
  title: string;
  synopsis: string;
  fandom: string;
  language: string;
  body: string;
}

const emptyForm = (language: string): FictionFormState => ({
  title: '',
  synopsis: '',
  fandom: '',
  language,
  body: '',
});

const toForm = (fiction: OwnerFictionDraft): FictionFormState => ({
  title: fiction.title,
  synopsis: fiction.synopsis,
  fandom: fiction.fandom,
  language: fiction.language || 'en',
  body: fiction.body,
});

function validateForm(form: FictionFormState) {
  const errors: Partial<Record<keyof FictionFormState, 'required' | 'tooLong'>> = {};
  if (!form.title.trim()) errors.title = 'required';
  if (form.title.trim().length > 200) errors.title = 'tooLong';
  if (form.synopsis.length > 2000) errors.synopsis = 'tooLong';
  if (form.fandom.length > 120) errors.fandom = 'tooLong';
  if (!form.body.trim()) errors.body = 'required';
  return errors;
}

export function FictionWorkspacePage() {
  const { t, locale, formatDateTime } = useI18n();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | 'new'>('new');
  const [form, setForm] = useState<FictionFormState>(() => emptyForm(locale));
  const [dirty, setDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validateForm>>({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const ownerQuery = useQuery({
    queryKey: ['fiction', 'owner'],
    queryFn: listOwnerFictions,
  });

  const selected = useMemo(
    () => ownerQuery.data?.find((fiction) => fiction.fictionId === selectedId),
    [ownerQuery.data, selectedId],
  );

  useEffect(() => {
    if (selectedId === 'new') {
      setForm(emptyForm(locale));
    } else if (selected) {
      setForm(toForm(selected));
    }
    setDirty(false);
    setFieldErrors({});
    setConfirmSubmit(false);
    setStatusMessage('');
  }, [locale, selected, selectedId]);

  const createMutation = useMutation({ mutationFn: createFiction });
  const saveMutation = useMutation({
    mutationFn: ({ workId, input }: { workId: string; input: Parameters<typeof saveFictionDraft>[1] }) =>
      saveFictionDraft(workId, input),
  });
  const submitMutation = useMutation({
    mutationFn: ({ workId, version }: { workId: string; version: bigint }) => submitFiction(workId, version),
  });

  const state = selected?.state ?? 'new';
  const isEditable = state === 'new' || state === 'draft' || state === 'rejected';
  const isSaving = createMutation.isPending || saveMutation.isPending;
  const mutationError = createMutation.error ?? saveMutation.error ?? submitMutation.error;

  const updateField = <Key extends keyof FictionFormState>(key: Key, value: FictionFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setStatusMessage('');
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async () => {
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !isEditable) return;

    createMutation.reset();
    saveMutation.reset();
    submitMutation.reset();

    const input = {
      title: form.title.trim(),
      synopsis: form.synopsis.trim(),
      fandom: form.fandom.trim(),
      contentRating: ContentRating.ALL_AGES,
      body: form.body,
    };

    if (selectedId === 'new') {
      const created = await createMutation.mutateAsync({ ...input, language: form.language });
      setSelectedId(created.workId);
    } else {
      await saveMutation.mutateAsync({ workId: selectedId, input });
    }

    setDirty(false);
    setStatusMessage(t('fictionWorkspace.saved'));
    await queryClient.invalidateQueries({ queryKey: ['fiction', 'owner'] });
  };

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault();
    try {
      await save();
    } catch {
      // Mutation state retains the localized error surface and local form data.
    }
  };

  const handleSubmit = async () => {
    if (!selected || dirty || selected.state !== 'draft') return;
    try {
      await submitMutation.mutateAsync({ workId: selected.fictionId, version: selected.workVersion });
      setConfirmSubmit(false);
      setStatusMessage(t('fictionWorkspace.submitSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['fiction', 'owner'] });
    } catch {
      // Keep confirmation and draft state visible for recovery.
    }
  };

  const handleStartRevision = async () => {
    if (!selected || selected.state !== 'published') return;
    createMutation.reset();
    saveMutation.reset();
    submitMutation.reset();
    try {
      await saveMutation.mutateAsync({
        workId: selected.fictionId,
        input: {
          title: selected.title,
          synopsis: selected.synopsis,
          fandom: selected.fandom,
          contentRating: ContentRating.ALL_AGES,
          body: selected.body,
        },
      });
      setStatusMessage(t('fictionWorkspace.revisionStarted'));
      setConfirmSubmit(false);
      await queryClient.invalidateQueries({ queryKey: ['fiction', 'owner'] });
    } catch {
      // Mutation state retains the localized error surface.
    }
  };

  const fieldError = (field: keyof FictionFormState) => {
    const error = fieldErrors[field];
    if (!error) return undefined;
    if (error === 'required') {
      return field === 'title' ? t('fictionWorkspace.validationTitle') : t('fictionWorkspace.validationBody');
    }
    if (field === 'title') return t('fictionWorkspace.validationTitleLength');
    if (field === 'synopsis') return t('fictionWorkspace.validationSynopsisLength');
    return t('fictionWorkspace.validationFandomLength');
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10 pt-2 sm:pt-4">
      <header className="flex flex-col gap-4 border-b border-ink/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('fictionWorkspace.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/fiction" className={buttonStyles({ variant: 'outline', className: 'min-h-11' })}>
            <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('fictionWorkspace.browse')}
          </Link>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => setSelectedId('new')}
            disabled={selectedId === 'new'}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('fictionWorkspace.new')}
          </Button>
        </div>
      </header>

      {ownerQuery.isLoading && (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]" aria-busy="true">
          <div className="h-72 animate-pulse rounded-md bg-ink/10" />
          <div className="h-[36rem] animate-pulse rounded-md bg-ink/10" />
        </div>
      )}

      {ownerQuery.error && (
        <ErrorState
          title={t('fictionWorkspace.unavailableTitle')}
          description={t(fictionErrorKey(ownerQuery.error, 'fictionWorkspace.errorFallback'))}
          action={<Button onClick={() => void ownerQuery.refetch()}>{t('common.retry')}</Button>}
        />
      )}

      {!ownerQuery.isLoading && !ownerQuery.error && (
        <div className="grid gap-7 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <aside className="space-y-3 lg:sticky lg:top-4" aria-label={t('fictionWorkspace.listTitle')}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-2">{t('fictionWorkspace.listTitle')}</h2>
              <span className="text-xs text-ink-3">{ownerQuery.data?.length ?? 0}</span>
            </div>
            <div className="max-h-[65vh] space-y-1 overflow-y-auto border-y border-ink/10 py-2">
              <button
                type="button"
                onClick={() => setSelectedId('new')}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                  selectedId === 'new' ? 'bg-ink text-paper' : 'hover:bg-accent',
                )}
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('fictionWorkspace.new')}
              </button>
              {ownerQuery.data?.map((fiction) => {
                const current = selectedId === fiction.fictionId;
                const stateKey = isFictionState(fiction.state) ? fictionStateKeys[fiction.state] : undefined;

                return (
                  <button
                    key={fiction.fictionId}
                    type="button"
                    onClick={() => setSelectedId(fiction.fictionId)}
                    className={cn(
                      'min-h-14 w-full rounded-md px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                      current ? 'bg-ink text-paper' : 'hover:bg-accent',
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{fiction.title}</span>
                    <span className={cn('mt-1 flex items-center justify-between gap-2 text-xs', current ? 'text-paper/75' : 'text-ink-2')}>
                      <span>{stateKey ? t(stateKey) : fiction.state}</span>
                      <span>#{fiction.revisionNumber}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {ownerQuery.data?.length === 0 && selectedId !== 'new' && (
              <EmptyState title={t('fictionWorkspace.empty')} className="min-h-40" />
            )}
          </aside>

          <main>
            <form
              onSubmit={handleSave}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                  event.preventDefault();
                  void handleSave();
                }
              }}
              className="space-y-6"
            >
              <section className="flex flex-col gap-3 border-b border-ink/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold text-ink">
                      {selectedId === 'new' ? t('fictionWorkspace.newTitle') : selected?.title}
                    </h2>
                    {state !== 'new' && isFictionState(state) && (
                      <span className="rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink-2">
                        {t(fictionStateKeys[state])}
                      </span>
                    )}
                    {dirty && <span className="text-xs font-medium text-warning">{t('fictionWorkspace.unsaved')}</span>}
                  </div>
                  {selected?.updatedAt && (
                    <p className="mt-2 text-sm text-ink-2">
                      {t('fictionWorkspace.updated', { date: formatDateTime(selected.updatedAt) })}
                    </p>
                  )}
                </div>
                {selected?.state === 'published' && (
                  <Link
                    to="/fiction/$id"
                    params={{ id: selected.fictionId }}
                    className={buttonStyles({ variant: 'outline', className: 'min-h-11' })}
                  >
                    {t('fictionWorkspace.openPublic')}
                  </Link>
                )}
              </section>

              {!isEditable && (
                <div className="space-y-3">
                  <FormMessage variant="info">
                    {state === 'pending'
                      ? t('fictionWorkspace.pendingReadonly')
                      : state === 'published'
                        ? t('fictionWorkspace.publishedReadonly')
                        : t('fictionWorkspace.withdrawnReadonly')}
                  </FormMessage>
                  {selected?.state === 'published' && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => void handleStartRevision()}
                        disabled={saveMutation.isPending}
                      >
                        <FilePenLine className="mr-2 h-4 w-4" aria-hidden="true" />
                        {saveMutation.isPending
                          ? t('fictionWorkspace.startingRevision')
                          : t('fictionWorkspace.startRevision')}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('fictionWorkspace.fieldTitle')} htmlFor="fiction-title" required error={fieldError('title')}>
                  <Input
                    id="fiction-title"
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    disabled={!isEditable}
                    invalid={Boolean(fieldErrors.title)}
                    maxLength={200}
                    aria-describedby={fieldErrors.title ? 'fiction-title-error' : undefined}
                  />
                </Field>
                <Field label={t('fictionWorkspace.fieldFandom')} htmlFor="fiction-work-fandom" error={fieldError('fandom')}>
                  <Input
                    id="fiction-work-fandom"
                    value={form.fandom}
                    onChange={(event) => updateField('fandom', event.target.value)}
                    disabled={!isEditable}
                    invalid={Boolean(fieldErrors.fandom)}
                    maxLength={120}
                  />
                </Field>
                <Field label={t('fictionWorkspace.fieldLanguage')} htmlFor="fiction-language">
                  <Select
                    id="fiction-language"
                    value={form.language}
                    onChange={(event) => updateField('language', event.target.value)}
                    disabled={!isEditable || Boolean(selected)}
                  >
                    <option value="en">{t('language.en')}</option>
                    <option value="zh-Hans">{t('language.zhHans')}</option>
                    <option value="zh-Hant">{t('language.zhHant')}</option>
                    <option value="ja">{t('language.ja')}</option>
                  </Select>
                </Field>
                <Field label={t('work.rating')} htmlFor="fiction-rating">
                  <Input id="fiction-rating" value={t('rating.allAges')} disabled readOnly />
                </Field>
              </div>

              <Field label={t('fictionWorkspace.fieldSynopsis')} htmlFor="fiction-synopsis" error={fieldError('synopsis')}>
                <Textarea
                  id="fiction-synopsis"
                  value={form.synopsis}
                  onChange={(event) => updateField('synopsis', event.target.value)}
                  disabled={!isEditable}
                  invalid={Boolean(fieldErrors.synopsis)}
                  maxLength={2000}
                  className="min-h-24"
                />
              </Field>

              <Field
                label={t('fictionWorkspace.fieldBody')}
                htmlFor="fiction-body"
                required
                error={fieldError('body')}
              >
                <Textarea
                  id="fiction-body"
                  value={form.body}
                  onChange={(event) => updateField('body', event.target.value)}
                  disabled={!isEditable}
                  invalid={Boolean(fieldErrors.body)}
                  className="min-h-[28rem] font-serif text-base leading-7"
                  aria-describedby={fieldErrors.body ? 'fiction-body-error' : undefined}
                />
              </Field>

              {mutationError && (
                <FormMessage>
                  {t(fictionErrorKey(mutationError, 'fictionWorkspace.errorSaveFallback'))}
                </FormMessage>
              )}

              <div aria-live="polite" className="min-h-5 text-sm text-success">
                {statusMessage}
              </div>

              <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-wrap justify-end gap-2">
                  {selected && selected.state === 'draft' && !dirty && !confirmSubmit && (
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmSubmit(true)}>
                      <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('fictionWorkspace.submit')}
                    </Button>
                  )}
                  {isEditable && (
                    <Button type="submit" className="min-h-11" disabled={isSaving || (!dirty && selectedId !== 'new')}>
                      {isSaving ? (
                        <Clock3 className="mr-2 h-4 w-4" aria-hidden="true" />
                      ) : selectedId === 'new' ? (
                        <FilePenLine className="mr-2 h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      {isSaving
                        ? t('fictionWorkspace.saving')
                        : selectedId === 'new'
                          ? t('fictionWorkspace.createDraft')
                          : t('fictionWorkspace.saveDraft')}
                    </Button>
                  )}
                </div>
              </div>

              {confirmSubmit && selected && (
                <section className="rounded-md border border-warning/30 bg-warning/5 p-4" aria-labelledby="fiction-submit-title">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <h3 id="fiction-submit-title" className="font-semibold text-ink">{t('fictionWorkspace.submitTitle')}</h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" onClick={() => void handleSubmit()} disabled={submitMutation.isPending}>
                          {submitMutation.isPending ? t('fictionWorkspace.submitting') : t('fictionWorkspace.confirmSubmit')}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setConfirmSubmit(false)} disabled={submitMutation.isPending}>
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </form>
          </main>
        </div>
      )}
    </div>
  );
}
