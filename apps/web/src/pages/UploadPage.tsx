import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Upload, X } from 'lucide-react';
import { FileDropZone } from '../components/FileDropZone';
import { ImagePreview } from '../components/ImagePreview';
import { UploadForm } from '../components/UploadForm';
import { Button } from '@hasu-gallery/ui';
import { uploadWork } from '../api/upload';
import type { Work } from '@hasu-gallery/types';

export function UploadPage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedWork, setUploadedWork] = useState<Work | null>(null);

  const mutation = useMutation({
    mutationFn: uploadWork,
    onSuccess: (data) => {
      setUploadedWork(data);
      setSelectedFile(null);
    },
  });

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
      navigate(`/works/${uploadedWork.id}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Upload Work</h1>

        {uploadedWork ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Upload Successful!
              </h2>
              <p className="text-muted-foreground">
                Your work has been uploaded and is pending approval.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-4">
              <Button onClick={handleViewWork} variant="default">
                View Work
              </Button>
              <Button onClick={handleUploadAnother} variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload Another
              </Button>
            </div>
          </div>
        ) : (
          <>
            {mutation.error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Upload failed
                  </p>
                  <p className="text-sm text-destructive/90 mt-1">
                    {mutation.error.message}
                  </p>
                </div>
                <button
                  onClick={() => mutation.reset()}
                  className="text-destructive hover:text-destructive/80 transition-colors"
                  aria-label="Dismiss error"
                >
                  <X className="w-5 h-5" />
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
