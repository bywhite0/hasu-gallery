import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadForm } from './UploadForm';

const file = new File(['x'], 'a.png', { type: 'image/png' });

describe('UploadForm validation matrix', () => {
  const onSubmit = vi.fn<(data: FormData) => Promise<void>>();

  beforeEach(() => {
    onSubmit.mockReset();
    onSubmit.mockResolvedValue(undefined);
  });

  const renderForm = () => render(<UploadForm file={file} onSubmit={onSubmit} isUploading={false} />);

  it('requires origin for memes and source for derived/fan-made memes', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'A meme');
    await user.selectOptions(screen.getByRole('combobox', { name: /Gallery/ }), 'meme');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(await screen.findByText('Origin is required for memes')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByRole('combobox', { name: /Origin/ }), 'derived');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(
      await screen.findByText('Source is required for derived or fan-made memes'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: 'Source' }), 'Original artwork by X');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const formData = onSubmit.mock.calls[0][0];
    expect(formData.get('gallery')).toBe('meme');
    expect(formData.get('origin')).toBe('derived');
    expect(formData.get('source')).toBe('Original artwork by X');
    expect(formData.get('file')).toBe(file);
  });

  it('requires artist, rating, and a valid source URL for art', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole('textbox', { name: /Title/ }), 'An artwork');
    await user.selectOptions(screen.getByRole('combobox', { name: /Gallery/ }), 'art');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(await screen.findByText('Artist is required for art')).toBeInTheDocument();
    expect(screen.getByText('Source URL is required for art')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: /Artist/ }), 'Painter');
    await user.type(screen.getByRole('textbox', { name: 'Source URL' }), 'not-a-url');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(await screen.findByText('Invalid URL format')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(screen.getByRole('textbox', { name: 'Source URL' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Source URL' }),
      'https://example.com/art/1',
    );
    await user.selectOptions(screen.getByRole('combobox', { name: /Rating/ }), 'r15');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const formData = onSubmit.mock.calls[0][0];
    expect(formData.get('gallery')).toBe('art');
    expect(formData.get('artist')).toBe('Painter');
    expect(formData.get('rating')).toBe('r15');
    expect(formData.get('source_url')).toBe('https://example.com/art/1');
    expect(formData.get('origin')).toBeNull();
  });

  it('requires a title and a gallery kind before submitting', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Gallery type is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
