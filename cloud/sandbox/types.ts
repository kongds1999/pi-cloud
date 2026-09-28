/**
 * pi-cloud sandbox abstraction.
 *
 * Model: **ephemeral compute, persistent filesystem.**
 * A sandbox is a short-lived execution environment (container / micro-VM)
 * that mounts one persistent volume (a workspace). When the sandbox is
 * destroyed, the compute goes away; the volume — and everything the agent
 * wrote into it — survives and is re-attached on the next launch.
 *
 * The agent itself runs *inside* the sandbox (the whole pi AgentSession),
 * and streams events back to the web server. This keeps tool semantics
 * (bash, file edits, git) exactly as pi defines them, instead of splitting
 * the agent loop from its tools.
 */

export interface ExecChunk {
  stream: "stdout" | "stderr";
  data: string;
}

export interface SandboxExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

/** A persistent filesystem unit. Survives sandbox destruction. */
export interface SandboxVolume {
  /** Stable id, e.g. the cloud_workspaces row id. */
  id: string;
}

/** One live, ephemeral execution environment. */
export interface Sandbox {
  readonly id: string;
  readonly volume: SandboxVolume;

  /** Working directory inside the sandbox (mount point of the volume). */
  readonly workdir: string;

  exec(
    command: string,
    opts?: SandboxExecOptions,
  ): AsyncIterable<ExecChunk> & { exitCode: Promise<number> };

  writeFile(path: string, data: string | Uint8Array): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  fileExists(path: string): Promise<boolean>;

  /**
   * Destroy the compute. The volume persists. After this resolves the
   * Sandbox must not be used.
   */
  destroy(): Promise<void>;
}

export interface SandboxAcquireOptions {
  /** Container image carrying node + pi runtime. */
  image?: string;
  /** Extra env for the agent process (model keys etc.). Never logged. */
  env?: Record<string, string>;
  /** Soft idle timeout; provider may destroy the sandbox after it. */
  idleTimeoutMs?: number;
}

export interface SandboxProvider {
  readonly name: string;

  /**
   * Boot an ephemeral sandbox with `volume` attached. Fast path should be
   * seconds, not minutes — images are pre-baked with the pi runtime.
   */
  acquire(
    volume: SandboxVolume,
    opts?: SandboxAcquireOptions,
  ): Promise<Sandbox>;

  /** Best-effort cleanup of leaked sandboxes (e.g. on server restart). */
  reapOrphans?(): Promise<void>;
}
