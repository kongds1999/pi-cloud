/**
 * Hosted sandbox provider stub (E2B).
 *
 * E2B gives exactly the model pi-cloud wants: ephemeral sandboxes with
 * persistent storage semantics via its filesystem persistence options.
 * Fill in with the @e2b/code-interpreter SDK in Phase 2.
 *
 * Kept as a stub so the provider interface is validated against a second
 * shape early — local-docker alone would let the interface drift toward
 * docker-isms.
 */

import type {
  Sandbox,
  SandboxAcquireOptions,
  SandboxProvider,
  SandboxVolume,
} from "./types";

export class E2BProvider implements SandboxProvider {
  readonly name = "e2b";

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("E2BProvider requires an API key (E2B_API_KEY)");
  }

  async acquire(_volume: SandboxVolume, _opts: SandboxAcquireOptions = {}): Promise<Sandbox> {
    throw new Error(
      "E2BProvider not implemented yet — Phase 2. " +
      "See ROADMAP.md. Use LocalDockerProvider for local development.",
    );
  }
}
