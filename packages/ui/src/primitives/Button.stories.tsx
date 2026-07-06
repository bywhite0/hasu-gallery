import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Open gallery",
    variant: "default",
    size: "md",
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["default", "outline", "ghost"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: "Click me",
    variant: "default",
  },
};

export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
};

export const Ghost: Story = {
  args: {
    children: "Ghost",
    variant: "ghost",
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const VariantMatrix: Story = {
  render: () => (
    <div className="grid max-w-xl gap-4 rounded-md border border-border bg-surface p-4">
      <div className="grid grid-cols-[6rem_1fr_1fr] items-center gap-3 text-sm">
        <span className="font-semibold text-ink">Default</span>
        <Button variant="default">Primary action</Button>
        <Button variant="default" disabled>
          Disabled
        </Button>
      </div>
      <div className="grid grid-cols-[6rem_1fr_1fr] items-center gap-3 text-sm">
        <span className="font-semibold text-ink">Outline</span>
        <Button variant="outline">Secondary action</Button>
        <Button variant="outline" disabled>
          Disabled
        </Button>
      </div>
      <div className="grid grid-cols-[6rem_1fr_1fr] items-center gap-3 text-sm">
        <span className="font-semibold text-ink">Ghost</span>
        <Button variant="ghost">Quiet action</Button>
        <Button variant="ghost" disabled>
          Disabled
        </Button>
      </div>
    </div>
  ),
};

export const MobileWidth: Story = {
  render: () => (
    <div className="w-[390px] max-w-full space-y-3 rounded-lg border border-border bg-surface p-4">
      <Button className="w-full">Submit upload</Button>
      <Button className="w-full" variant="outline">
        Review details
      </Button>
      <Button className="w-full" variant="ghost">
        Cancel
      </Button>
    </div>
  ),
};
