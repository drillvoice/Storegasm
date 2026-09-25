// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { TEST_DATABASE_URL, connect, createUser } from "./setup";

/**
 * The data layer against a real, migrated Postgres. These cover what the
 * mocked unit tests can't: the SQL itself, the migrations' constraints and
 * triggers, and the foreign keys the data layer relies on instead of
 * checking first.
 */

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({
  db: new Proxy({}, { get: (_t, prop) => Reflect.get(h.db as object, prop) }),
}));

import * as environmentsDb from "@/lib/db/environments";
import * as itemsDb from "@/lib/db/items";
import * as spacesDb from "@/lib/db/spaces";

describe.skipIf(!TEST_DATABASE_URL)("data layer on Postgres", () => {
  let pool: ReturnType<typeof connect>["pool"];

  beforeAll(async () => {
    const connection = connect();
    pool = connection.pool;
    h.db = connection.db;
    await pool.query(`TRUNCATE "user" CASCADE`);
  });

  afterAll(async () => {
    await pool?.end();
  });

  /** A fresh user with one environment, "Home". */
  async function setUp(id: string) {
    await createUser(pool, id);
    const envs = await environmentsDb.ensureDefaultEnvironment(id);
    return { userId: id, home: envs.data![0].id };
  }

  it("creates exactly one default environment under concurrent first reads", async () => {
    await createUser(pool, "race");

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        environmentsDb.ensureDefaultEnvironment("race")
      )
    );

    expect(results.every((r) => r.error === null)).toBe(true);
    const envs = await environmentsDb.fetchEnvironments("race");
    expect(envs.data!.map((e) => e.name)).toEqual(["My Home"]);
  });

  it("refuses rows in another user's environment", async () => {
    const { userId } = await setUp("owner-a");
    const { home: otherHome } = await setUp("owner-b");

    const space = await spacesDb.createSpace(userId, otherHome, { name: "X" });
    const item = await itemsDb.createItem(userId, otherHome, { name: "X" });

    expect(space.error?.message).toBe("Environment not found");
    expect(item.error?.message).toBe("Environment not found");
  });

  it("keeps a space's parent in its environment", async () => {
    const { userId, home } = await setUp("parents");
    const office = (await environmentsDb.createEnvironment(userId, { name: "Office" })).data!.id;
    const bedroom = (await spacesDb.createSpace(userId, home, { name: "Bedroom" })).data!;
    const desk = (await spacesDb.createSpace(userId, office, { name: "Desk" })).data!;

    const created = await spacesDb.createSpace(userId, office, {
      name: "Drawer",
      parent_id: bedroom.id,
    });
    const reparented = await spacesDb.updateSpace(userId, desk.id, {
      parent_id: bedroom.id,
    });

    expect(created.error?.message).toBe("Parent space is not in that environment");
    expect(reparented.error?.message).toBe("Parent space is not in that environment");
  });

  it("refuses parent loops", async () => {
    const { userId, home } = await setUp("loops");
    const a = (await spacesDb.createSpace(userId, home, { name: "A" })).data!;
    const b = (await spacesDb.createSpace(userId, home, { name: "B", parent_id: a.id })).data!;

    const self = await spacesDb.updateSpace(userId, a.id, { parent_id: a.id });
    const loop = await spacesDb.updateSpace(userId, a.id, { parent_id: b.id });

    expect(self.error?.message).toBe("A space cannot be its own parent");
    expect(loop.error?.message).toBe("A space cannot be moved into its own contents");
  });

  it("moves a space's whole subtree and its items to another environment", async () => {
    const { userId, home } = await setUp("mover");
    const office = (await environmentsDb.createEnvironment(userId, { name: "Office" })).data!.id;
    const bedroom = (await spacesDb.createSpace(userId, home, { name: "Bedroom" })).data!;
    const underBed = (await spacesDb.createSpace(userId, home, { name: "Under bed", parent_id: bedroom.id })).data!;
    const desk = (await spacesDb.createSpace(userId, office, { name: "Desk" })).data!;
    const sock = (await itemsDb.createItem(userId, home, { name: "Sock", space_id: underBed.id })).data!;

    const moved = await spacesDb.moveSpaceToEnvironment(userId, bedroom.id, office, desk.id);

    expect(moved.error).toBeNull();
    const tree = (await spacesDb.fetchSpaceTree(userId, office)).data!;
    expect(tree[0].name).toBe("Desk");
    expect(tree[0].children[0].name).toBe("Bedroom");
    expect(tree[0].children[0].children[0].name).toBe("Under bed");
    expect((await spacesDb.fetchSpaceTree(userId, home)).data).toEqual([]);
    const items = (await itemsDb.fetchItemsBySpace(userId, office, underBed.id)).data!;
    expect(items.map((i) => i.id)).toEqual([sock.id]);
  });

  it("unassigns items when their space is deleted, keeping their environment", async () => {
    const { userId, home } = await setUp("deleter");
    const shed = (await spacesDb.createSpace(userId, home, { name: "Shed" })).data!;
    const shelf = (await spacesDb.createSpace(userId, home, { name: "Shelf", parent_id: shed.id })).data!;
    await itemsDb.createItem(userId, home, { name: "Rake", space_id: shelf.id });

    await spacesDb.deleteSpace(userId, shed.id);

    expect((await spacesDb.fetchSpaceTree(userId, home)).data).toEqual([]);
    const loose = (await itemsDb.fetchUnassignedItems(userId, home)).data!;
    expect(loose.map((i) => i.name)).toEqual(["Rake"]);
  });

  it("moves an item to its new space's environment", async () => {
    const { userId, home } = await setUp("follower");
    const office = (await environmentsDb.createEnvironment(userId, { name: "Office" })).data!.id;
    const desk = (await spacesDb.createSpace(userId, office, { name: "Desk" })).data!;
    const pen = (await itemsDb.createItem(userId, home, { name: "Pen" })).data!;

    const updated = await itemsDb.updateItem(userId, pen.id, { space_id: desk.id });

    expect(updated.data!.environment_id).toBe(office);
  });

  it("matches search words as prefixes and builds full breadcrumbs", async () => {
    const { userId, home } = await setUp("searcher");
    const bedroom = (await spacesDb.createSpace(userId, home, { name: "Bedroom" })).data!;
    const underBed = (await spacesDb.createSpace(userId, home, { name: "Under bed", parent_id: bedroom.id })).data!;
    const tub = (await spacesDb.createSpace(userId, home, { name: "Tub 1", parent_id: underBed.id })).data!;
    await itemsDb.createItem(userId, home, { name: "Screwdriver set", space_id: tub.id, tags: ["usb-c"] });
    await itemsDb.createItem(userId, home, { name: "Winter coats" });

    const screw = (await itemsDb.searchItems(userId, home, "screw")).data!;
    const coat = (await itemsDb.searchItems(userId, null, "wint coat")).data!;
    const tag = (await itemsDb.searchItems(userId, home, "usb-c")).data!;

    expect(screw.map((i) => i.space_path)).toEqual(["Bedroom › Under bed › Tub 1"]);
    expect(coat.map((i) => i.name)).toEqual(["Winter coats"]);
    expect(tag.map((i) => i.name)).toEqual(["Screwdriver set"]);
    expect((await itemsDb.fetchAllTags(userId, home)).data).toEqual(["usb-c"]);
  });

  it("stamps updated_at when an environment changes", async () => {
    const { userId, home } = await setUp("stamper");
    await pool.query(
      `UPDATE environments SET updated_at = now() - interval '1 day' WHERE id = $1`,
      [home]
    );

    const renamed = await environmentsDb.updateEnvironment(userId, home, { name: "House" });

    expect(Date.now() - Date.parse(renamed.data!.updated_at)).toBeLessThan(60_000);
  });

  it("deletes an environment's contents with it, but never the last one", async () => {
    const { userId, home } = await setUp("cleaner");
    const office = (await environmentsDb.createEnvironment(userId, { name: "Office" })).data!.id;
    const desk = (await spacesDb.createSpace(userId, office, { name: "Desk" })).data!;
    await itemsDb.createItem(userId, office, { name: "Stapler", space_id: desk.id });

    expect((await environmentsDb.countEnvironmentContents(userId, office)).data).toEqual({ spaces: 1, items: 1 });
    await environmentsDb.deleteEnvironment(userId, office);
    const last = await environmentsDb.deleteEnvironment(userId, home);

    expect((await environmentsDb.fetchEnvironments(userId)).data!.map((e) => e.id)).toEqual([home]);
    expect(last.error?.message).toMatch(/only environment/);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM items WHERE user_id = $1`, [userId]);
    expect(rows[0].n).toBe(0);
  });
});
