/**
 * Reference SandboxProvider for local development / testing.
 *
 * Ephemeral compute  = `docker run --rm -d` (removed on destroy)
 * Persistent FS      = a host directory under CLOUD_VOLUME_ROOT/<volumeId>
 *                      bind-mounted into the container.
 *
 * This is what "clean environment per task, files survive" looks like in
 * the cheapest possible form, and it runs entirely on the developer's
 * machine — no cloud account needed.
 *
 * Requires: docker CLI on PATH, and an image with node >= 22
 * (default: node:22-bookworm-slim).
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, writeFile, readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import type {
  ExecChunk,
  Sandbox,
  SandboxAcquireOptions,
  SandboxProvider,
  SandboxVolume,
} from "./types";

const execFileAsync = promisify(execFile);

function volumeRoot(): string {
  return resolve(
    process.env.CLOUD_VOLUME_ROOT ?? join(process.env.HOME ?? "/tmp", ".pi-cloud", "volumes"),
  );
}

async function docker(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("docker", args, { maxBuffer: 64 * 1024 * 1024 });
  return stdout.trim();
}

class LocalDockerSandbox implements Sandbox {
  readonly workdir = "/work";

  constructor(
    readonly id: string, // docker container id
    readonly volume: SandboxVolume,
  ) {}

  exec(
    command: string,
    opts: { cwd?: string; env?: Record<string, string>; timeoutMs?: number } = {},
  ): AsyncIterable<ExecChunk> & { exitCode: Promise<number> } {
    const args = ["exec"];
    if (opts.cwd) args.push("-w", opts.cwd);
    for (const [k, v] of Object.entries(opts.env ?? {})) args.push("-e", `${k}=${v}`);
    args.push(this.id, "sh", "-c", command);

    let resolveExit!: (code: number) => void;
    const exitCode = new Promise<number>((r) => { resolveExit = r; });

    const stream: AsyncGenerator<ExecChunk> = (async function* (): AsyncGenerator<ExecChunk> {
      const { spawn } = await import("child_process");
      const child = spawn("docker", args, { timeout: opts.timeoutMs });
      const chunks: ExecChunk[] = [];
      child.stdout.on("data", (d: Buffer) => chunks.push({ stream: "stdout", data: d.toString() }));
      child.stderr.on("data", (d: Buffer) => chunks.push({ stream: "stderr", data: d.toString() }));
      const code: number = await new Promise((res) => child.on("close", res));
      resolveExit(code);
      yield* chunks;
    })();

    return Object.assign(stream, { exitCode });
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    const hostPath = join(volumeRoot(), this.volume.id, path);
    await mkdir(join(hostPath, ".."), { recursive: true });
    await writeFile(hostPath, data);
  }

  async readFile(path: string): Promise<Uint8Array> {
    return readFile(join(volumeRoot(), this.volume.id, path));
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await stat(join(volumeRoot(), this.volume.id, path));
      return true;
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    // --rm was set at create; `docker rm -f` on an already-removed
    // container is a no-op we tolerate.
    await docker("rm", "-f", this.id).catch(() => undefined);
  }
}

export class LocalDockerProvider implements SandboxProvider {
  readonly name = "local-docker";

  async acquire(volume: SandboxVolume, opts: SandboxAcquireOptions = {}): Promise<Sandbox> {
    const hostDir = join(volumeRoot(), volume.id);
    await mkdir(hostDir, { recursive: true });
    const image = opts.image ?? "node:22-bookworm-slim";
    const id = await docker(
      "run", "--rm", "-d",
      "-v", `${hostDir}:/work`,
      "-w", "/work",
      ...Object.entries(opts.env ?? {}).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
      image, "sleep", "infinity",
    );
    return new LocalDockerSandbox(id, volume);
  }
}
