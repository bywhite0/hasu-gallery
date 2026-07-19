import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FictionBody } from './FictionBody';

describe('FictionBody', () => {
  it('renders the allowlisted HFM syntax as React nodes', () => {
    render(
      <FictionBody
        body={'First *moment*.\\\nSecond line.\n\nSee [the archive](https://example.com) and {{media:550e8400-e29b-41d4-a716-446655440000}}.'}
      />,
    );

    expect(screen.getByText('moment')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'the archive' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('note')).toHaveTextContent('illustration');
    expect(document.querySelector('script')).not.toBeInTheDocument();
  });

  it('keeps unsupported markup as escaped text', () => {
    render(<FictionBody body={'<script>alert(1)</script>'} />);
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
  });
});
