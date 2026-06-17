import { useParams, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@hasu-gallery/ui';
import { getWork } from '../api/works';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';

export function WorkDetailPage() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();

  const {
    data: work,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['work', id],
    queryFn: () => getWork(id as string),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Loading work...</p>
      </div>
    );
  }

  if (error || !work) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <p className="text-lg text-destructive">
          {error instanceof Error ? error.message : 'Failed to load work'}
        </p>
        <Link to="/gallery/meme">
          <Button variant="outline">Back to gallery</Button>
        </Link>
      </div>
    );
  }

  const handleDownload = () => {
    if (!work.file_url) return;
    const link = document.createElement('a');
    link.href = work.file_url;
    link.download = work.file_url.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: `/gallery/${work.gallery}` })}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {work.gallery}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Image section */}
        <div className="lg:col-span-2">
          <div className="bg-muted rounded-lg p-4">
            <img
              src={work.file_url}
              alt={work.title || 'Work image'}
              className="w-full h-auto max-w-4xl mx-auto rounded"
              loading="eager"
            />
          </div>
        </div>

        {/* Metadata panel */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-4">
              {work.title || 'Untitled'}
            </h1>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-1">
                Dimensions
              </h2>
              <p className="text-base">
                {work.width} × {work.height}
              </p>
            </div>

            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-1">
                Gallery
              </h2>
              <Link
                to={`/gallery/${work.gallery}`}
                className="text-base text-primary hover:underline"
              >
                {work.gallery}
              </Link>
            </div>

            {work.origin && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1">
                  Origin
                </h2>
                <p className="text-base">{work.origin}</p>
              </div>
            )}

            {work.source_url && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1">
                  Source
                </h2>
                <a
                  href={work.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-base text-primary hover:underline"
                >
                  View source
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {work.rights_note && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-1">
                  Rights
                </h2>
                <p className="text-sm text-muted-foreground">
                  {work.rights_note}
                </p>
              </div>
            )}

            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-1">
                Uploaded
              </h2>
              <p className="text-base">
                {new Date(work.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Download button */}
          <Button onClick={handleDownload} className="w-full gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
