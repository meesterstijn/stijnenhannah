import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual Edge Function locally. Only Supabase's signing/storage
// services are replaced; authorization runs against the real SQL migrations.
export async function guestFaceEdge(executeRpc, executeSql) {
  const uploads = new Map();
  const reads = new Map();
  const files = new Map();
  const api = { failNextFaceUpload: false };
  const storage = {
    async createSignedUploadUrl(path) {
      const token = randomUUID();
      uploads.set(token, path);
      return { data: { path, token }, error: null };
    },
    async createSignedUrl(path) {
      const token = randomUUID();
      reads.set(token, path);
      return {
        data: {
          signedUrl: `https://test.supabase.co/storage/v1/object/sign/game-night-player-faces/${path}?token=${token}`,
        },
        error: null,
      };
    },
  };
  const exports = {};
  const source = await readFile(
    new URL(
      "../../supabase/functions/game-night-guest-faces/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  });
  vm.runInNewContext(outputText, {
    exports,
    Request,
    Response,
    crypto: { randomUUID },
    Deno: { env: { get: () => "local-test-only" }, serve() {} },
    require(name) {
      assert.equal(name, "npm:@supabase/supabase-js@2.105.4");
      return {
        createClient: () => ({
          async rpc(name, args) {
            try {
              return { data: await executeRpc(name, args), error: null };
            } catch (error) {
              return { data: null, error };
            }
          },
          storage: {
            from(bucket) {
              assert.equal(bucket, "game-night-player-faces");
              return storage;
            },
          },
        }),
      };
    },
  });

  api.handle = exports.handleGuestFaceRequest;
  api.files = files;
  api.storageRequest = async (request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const uploadPrefix =
      "/storage/v1/object/upload/sign/game-night-player-faces/";
    const readPrefix = "/storage/v1/object/sign/game-night-player-faces/";
    if (request.method === "PUT" && url.pathname.startsWith(uploadPrefix)) {
      const path = decodeURIComponent(url.pathname.slice(uploadPrefix.length));
      if (uploads.get(token) !== path || files.has(path))
        return new Response("Forbidden", { status: 403 });
      if (path.endsWith("/face.png") && api.failNextFaceUpload) {
        api.failNextFaceUpload = false;
        return Response.json(
          { error: "Simulated interrupted upload" },
          { status: 500 },
        );
      }
      const blob = (await request.formData()).get("");
      assert(blob instanceof Blob);
      files.set(path, {
        bytes: Buffer.from(await blob.arrayBuffer()),
        type: blob.type,
      });
      await executeSql(
        "insert into storage.objects(bucket_id,name) values ('game-night-player-faces',$1)",
        [path],
      );
      return Response.json({ Key: `game-night-player-faces/${path}` });
    }
    const path = decodeURIComponent(url.pathname.slice(readPrefix.length));
    if (
      request.method === "GET" &&
      url.pathname.startsWith(readPrefix) &&
      reads.get(token) === path &&
      files.has(path)
    ) {
      const file = files.get(path);
      return new Response(file.bytes, {
        headers: { "content-type": file.type },
      });
    }
    return new Response("Forbidden", { status: 403 });
  };
  return api;
}
