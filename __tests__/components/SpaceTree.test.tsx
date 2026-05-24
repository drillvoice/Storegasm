import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpaceTree } from "@/components/spaces/SpaceTree";
import type { SpaceNode } from "@/lib/types";

function makeNode(overrides: Partial<SpaceNode> = {}): SpaceNode {
  return {
    id: "node-1",
    user_id: "user-1",
    name: "Bedroom",
    description: null,
    parent_id: null,
    created_at: "",
    updated_at: "",
    children: [],
    ...overrides,
  };
}

const defaultProps = {
  onAddRoot: vi.fn(),
  onAddChild: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe("SpaceTree", () => {
  it("renders an empty state with an add button when spaces is empty", () => {
    render(<SpaceTree spaces={[]} {...defaultProps} />);

    expect(screen.getByText(/no spaces yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add space/i })).toBeInTheDocument();
  });

  it("renders space names as links", () => {
    const node = makeNode({ name: "Bedroom" });
    render(<SpaceTree spaces={[node]} {...defaultProps} />);

    expect(screen.getByRole("link", { name: "Bedroom" })).toBeInTheDocument();
  });

  it("shows nested child spaces when expanded", () => {
    const child = makeNode({ id: "child-1", name: "Under bed", parent_id: "node-1" });
    const parent = makeNode({ children: [child] });

    render(<SpaceTree spaces={[parent]} {...defaultProps} />);

    // Root nodes start expanded, so the child should be visible.
    expect(screen.getByRole("link", { name: "Under bed" })).toBeInTheDocument();
  });

  it("collapses children when the toggle is clicked", async () => {
    const user = userEvent.setup();
    const child = makeNode({ id: "child-1", name: "Under bed", parent_id: "node-1" });
    const parent = makeNode({ children: [child] });

    render(<SpaceTree spaces={[parent]} {...defaultProps} />);

    // Child is visible initially (root expanded by default).
    expect(screen.getByRole("link", { name: "Under bed" })).toBeInTheDocument();

    const collapseBtn = screen.getByRole("button", { name: /collapse/i });
    await user.click(collapseBtn);

    expect(screen.queryByRole("link", { name: "Under bed" })).not.toBeInTheDocument();
  });

  it("calls onAddChild with the parent id when the add button is clicked", async () => {
    const user = userEvent.setup();
    const onAddChild = vi.fn();
    const node = makeNode({ id: "node-1", name: "Bedroom" });

    render(
      <SpaceTree
        spaces={[node]}
        {...defaultProps}
        onAddChild={onAddChild}
      />
    );

    const addBtn = screen.getByRole("button", { name: /add space inside bedroom/i });
    await user.click(addBtn);

    expect(onAddChild).toHaveBeenCalledWith("node-1");
  });

  it("calls onDelete when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const node = makeNode({ id: "node-1", name: "Bedroom" });

    render(<SpaceTree spaces={[node]} {...defaultProps} onDelete={onDelete} />);

    const deleteBtn = screen.getByRole("button", { name: /delete bedroom/i });
    await user.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledWith(node);
  });
});
