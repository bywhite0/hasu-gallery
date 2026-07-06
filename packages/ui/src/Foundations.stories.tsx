import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Foundations/Overview",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj;

type ColorToken = {
  name: string;
  value: string;
  role: string;
};

const coreColors: ColorToken[] = [
  { name: "paper", value: "#f7f7f3", role: "Page background" },
  { name: "surface", value: "#ffffff", role: "Raised surfaces and cards" },
  { name: "ink", value: "#383834", role: "Primary text and strong borders" },
  { name: "ink-2", value: "#6b6b62", role: "Secondary text" },
  { name: "ink-3", value: "#95948a", role: "Tertiary text and quiet metadata" },
  { name: "accent", value: "#fce8e6", role: "Soft hover and selected accents" },
  { name: "accent-dark", value: "#f8d7d3", role: "Pressed accent surfaces" },
];

const stateColors: ColorToken[] = [
  { name: "success", value: "#4f9e6e", role: "Approved or complete" },
  { name: "warning", value: "#c98a0c", role: "Pending or needs attention" },
  { name: "danger", value: "#ba2636", role: "Rejected, destructive, or failed" },
  { name: "info", value: "#5383c3", role: "Links and neutral callouts" },
];

const legacyAliases: ColorToken[] = [
  { name: "foreground", value: "var(--color-ink)", role: "Temporary app alias" },
  { name: "muted", value: "#efefe8", role: "Temporary quiet surface alias" },
  { name: "muted-foreground", value: "var(--color-ink-2)", role: "Temporary muted text alias" },
  { name: "card", value: "var(--color-surface)", role: "Temporary card alias" },
  { name: "border", value: "#d8d8d0", role: "Temporary soft border alias" },
  { name: "primary", value: "var(--color-info)", role: "Temporary link/action alias" },
  { name: "destructive", value: "var(--color-danger)", role: "Temporary destructive alias" },
];

const spacingTokens = [
  { name: "--space-xs", value: "0.25rem" },
  { name: "--space-sm", value: "0.5rem" },
  { name: "--space-md", value: "1rem" },
  { name: "--space-lg", value: "1.5rem" },
  { name: "--space-xl", value: "2rem" },
];

function StoryShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-paper p-6 text-ink md:p-10">{children}</main>;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-2">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ token }: { token: ColorToken }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div
        className="h-16 border-b border-border"
        style={{ background: token.value }}
        aria-label={`${token.name} color sample`}
      />
      <div className="space-y-1 p-3">
        <div className="font-mono text-xs font-semibold text-ink">--color-{token.name}</div>
        <div className="font-mono text-[11px] text-ink-3">{token.value}</div>
        <div className="text-xs text-ink-2">{token.role}</div>
      </div>
    </div>
  );
}

function SwatchGrid({ tokens }: { tokens: ColorToken[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tokens.map((token) => (
        <Swatch key={token.name} token={token} />
      ))}
    </div>
  );
}

function RuleCard({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <code className="rounded-sm bg-muted px-2 py-1 text-xs text-ink-2">{value}</code>
      </div>
      <div className="text-sm text-ink-2">{children}</div>
    </div>
  );
}

export const Palette: Story = {
  render: () => (
    <StoryShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-info">
            Hasu Gallery foundations
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Legal token vocabulary</h1>
          <p className="mt-3 text-ink-2">
            Use Hasu Gallery tokens directly. Linkura-apps is a method reference only; do not
            reuse its framed-paper visual style in this product.
          </p>
        </header>

        <Section title="Core Palette" description="Preferred near-term dialect for app and shared UI work.">
          <SwatchGrid tokens={coreColors} />
        </Section>

        <Section title="State Colors" description="Use these names for status, validation, and moderation states.">
          <SwatchGrid tokens={stateColors} />
        </Section>

        <Section
          title="Legacy Aliases"
          description="These aliases intentionally keep the current app compiling while pages migrate to the preferred dialect."
        >
          <SwatchGrid tokens={legacyAliases} />
        </Section>
      </div>
    </StoryShell>
  ),
};

export const TypographyAndSpacing: Story = {
  render: () => (
    <StoryShell>
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Typography" description="The UI package exposes product fonts through Tailwind v4 tokens.">
          <div className="space-y-4 rounded-md border border-border bg-surface p-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Sans</div>
              <p className="font-sans text-3xl font-bold text-ink">Meme Gallery / Art Gallery</p>
              <p className="mt-1 text-sm text-ink-2">
                Inter, system-ui, sans-serif for product UI, forms, and dense metadata.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">Serif</div>
              <p className="font-serif text-2xl text-ink">Hasu no Sora collection notes</p>
              <p className="mt-1 text-sm text-ink-2">
                Noto Serif JP is available for editorial moments, not for dense controls.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Spacing" description="App spacing tokens live outside Tailwind's utility scale namespace.">
          <div className="space-y-3 rounded-md border border-border bg-surface p-5">
            {spacingTokens.map((token) => (
              <div key={token.name} className="grid grid-cols-[5.5rem_1fr_4rem] items-center gap-3">
                <code className="text-xs text-ink-2">{token.name}</code>
                <div className="h-3 rounded-sm bg-info" style={{ width: token.value }} />
                <span className="font-mono text-xs text-ink-3">{token.value}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </StoryShell>
  ),
};

export const BordersRadiusAndStates: Story = {
  render: () => (
    <StoryShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <Section title="Borders And Radius" description="Keep primitives restrained and predictable.">
          <div className="grid gap-4 md:grid-cols-3">
            <RuleCard title="Default primitive" value="rounded-md border-border">
              Buttons, inputs, selects, and compact controls should use stable dimensions and a
              modest radius.
            </RuleCard>
            <RuleCard title="Task surfaces" value="rounded-lg">
              Upload panels and moderation blocks may use rounded-lg when they frame a complete
              workflow.
            </RuleCard>
            <RuleCard title="Strong borders" value="border-ink">
              Use ink borders sparingly for primary navigation and high-contrast structural lines.
            </RuleCard>
          </div>
        </Section>

        <Section title="State Samples" description="Reusable state components should align to this vocabulary.">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-md border border-success bg-success/10 p-4 text-success">
              <div className="font-semibold">Approved</div>
              <p className="mt-1 text-sm">Use success for completed review states.</p>
            </div>
            <div className="rounded-md border border-warning bg-warning/10 p-4 text-warning">
              <div className="font-semibold">Pending</div>
              <p className="mt-1 text-sm">Use warning for review queues and waiting states.</p>
            </div>
            <div className="rounded-md border border-danger bg-danger/10 p-4 text-danger">
              <div className="font-semibold">Rejected</div>
              <p className="mt-1 text-sm">Use danger for errors and destructive outcomes.</p>
            </div>
            <div className="rounded-md border border-info bg-info/10 p-4 text-info">
              <div className="font-semibold">Info</div>
              <p className="mt-1 text-sm">Use info for neutral links and guidance.</p>
            </div>
          </div>
        </Section>
      </div>
    </StoryShell>
  ),
};

export const MobileWidthFoundation: Story = {
  render: () => (
    <StoryShell>
      <div className="mx-auto w-[390px] max-w-full space-y-4 rounded-lg border border-border bg-surface p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-info">390px check</p>
          <h2 className="mt-1 text-xl font-bold text-ink">Gallery mobile baseline</h2>
          <p className="mt-2 text-sm text-ink-2">
            Auth and gallery stories should include a mobile-width sample before primitives are
            reused across pages.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {coreColors.slice(0, 6).map((token) => (
            <div key={token.name} className="rounded-md border border-border bg-paper p-2">
              <div className="mb-2 h-8 rounded-sm" style={{ background: token.value }} />
              <code className="text-[11px] text-ink-2">{token.name}</code>
            </div>
          ))}
        </div>
      </div>
    </StoryShell>
  ),
};

export const ComponentStoryPlan: Story = {
  render: () => (
    <StoryShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-info">Phase 5 scope guard</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Component story plan</h1>
          <p className="mt-3 text-ink-2">
            Shared primitives and gallery state components are being stabilized by earlier UI repair
            phases. Keep Phase 5 focused on executable documentation until those files settle.
          </p>
        </header>

        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-3 border-b border-border bg-muted px-4 py-3 text-sm font-semibold text-ink">
            <span>Component</span>
            <span>Story status</span>
            <span>Notes</span>
          </div>
          {[
            {
              component: "Button",
              status: "Documented now",
              notes: "Variant, size, disabled, and mobile-width samples live in Primitives/Button.",
            },
            {
              component: "Field, Input, Select",
              status: "Wait for primitive stabilization",
              notes: "Add form stories after Phase 2 owns final labels, errors, focus, and helper text.",
            },
            {
              component: "WorkCard",
              status: "Wait for gallery stabilization",
              notes: "Add card stories after Phase 3 replaces background thumbnails with semantic images.",
            },
            {
              component: "Loading, empty, error states",
              status: "Wait for state primitives",
              notes: "Add stories after reusable state components exist in packages/ui or a shared app boundary.",
            },
          ].map((row) => (
            <div
              key={row.component}
              className="grid grid-cols-[1fr_1fr_1.4fr] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
            >
              <span className="font-semibold text-ink">{row.component}</span>
              <span className="text-ink-2">{row.status}</span>
              <span className="text-ink-2">{row.notes}</span>
            </div>
          ))}
        </div>
      </div>
    </StoryShell>
  ),
};
