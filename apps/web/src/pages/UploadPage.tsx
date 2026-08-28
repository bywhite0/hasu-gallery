import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Upload, X } from 'lucide-react';
import { FileDropZone } from '../components/FileDropZone';
import { ImagePreview } from '../components/ImagePreview';
import { UploadForm } from '../components/UploadForm';
import { Button } from '@hasu-gallery/ui';
import { uploadWork } from '../api/upload';
import type { Work } from '@hasu-gallery/types';
import { useI18n } from '../i18n';
import { reportClientError } from '../lib/errorReporting';
import { isNetworkError } from '../lib/network';

const getUploadErrorMessage = (error: Error | null, t: ReturnType<typeof useI18n>['t']) => {
  if (!error) return null;

  if (isNetworkError(error)) {
    return t('upload.errorNetwork');
  }

  return t('upload.errorFallback');
};

export function UploadPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedWork, setUploadedWork] = useState<Work | null>(null);

  const mutation = useMutation({
    mutationFn: uploadWork,
    onSuccess: (data) => {
      setUploadedWork(data);
      setSelectedFile(null);
      // The profile works list and stats are stale the moment a new work
      // exists; without this the 5-minute staleTime hides the upload.
      void queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
  const uploadErrorReport = useMemo(
    () =>
      mutation.error
        ? reportClientError(mutation.error, { area: 'upload' })
        : null,
    [mutation.error],
  );
  const uploadError = getUploadErrorMessage(mutation.error, t);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    mutation.reset();
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    mutation.reset();
  };

  const handleSubmit = async (formData: FormData) => {
    await mutation.mutateAsync(formData);
  };

  const handleUploadAnother = () => {
    setUploadedWork(null);
    setSelectedFile(null);
    mutation.reset();
  };

  const handleViewWork = () => {
    if (uploadedWork) {
      navigate({ to: `/works/${uploadedWork.id}` as any });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-foreground">{t('upload.title')}</h1>

        {uploadedWork ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-success" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                {t('upload.successTitle')}
              </h2>
              <p className="text-muted-foreground">
                {t('upload.successDescription')}
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-4">
              <Button onClick={handleViewWork} variant="default">
                {t('upload.viewWork')}
              </Button>
              <Button onClick={handleUploadAnother} variant="outline">
                <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('upload.uploadAnother')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {uploadError && (
              <div role="alert" aria-live="assertive" className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    {t('upload.failed')}
                  </p>
                  <p className="text-sm text-destructive/90 mt-1">
                    {uploadError}
                  </p>
                  {uploadErrorReport && (
                    <p className="text-xs text-destructive/80 mt-2">
                      {t('error.reference', { reference: uploadErrorReport.reference })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => mutation.reset()}
                  className="text-destructive hover:text-destructive/80 transition-colors"
                  aria-label={t('upload.dismissError')}
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            )}

            {!selectedFile ? (
              <FileDropZone
                onFileSelect={handleFileSelect}
                disabled={mutation.isPending}
              />
            ) : (
              <div className="space-y-6">
                <ImagePreview file={selectedFile} onRemove={handleRemoveFile} />
                <UploadForm
                  file={selectedFile}
                  onSubmit={handleSubmit}
                  isUploading={mutation.isPending}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
