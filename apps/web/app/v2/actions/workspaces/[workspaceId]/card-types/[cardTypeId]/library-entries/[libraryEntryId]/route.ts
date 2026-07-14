import {
  appendForwardedQuery,
  proxyDelete,
  proxyGetJson,
  proxyPatch
} from "../../../../../../helpers";

type LibraryEntryParams = {
  workspaceId: string;
  cardTypeId: string;
  libraryEntryId: string;
};

function entryPath(params: LibraryEntryParams): string {
  return `/v2/workspaces/${encodeURIComponent(params.workspaceId)}/card-types/${encodeURIComponent(params.cardTypeId)}/library-entries/${encodeURIComponent(params.libraryEntryId)}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<LibraryEntryParams> }
) {
  return proxyGetJson(entryPath(await context.params));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<LibraryEntryParams> }
) {
  return proxyPatch(entryPath(await context.params), await request.json());
}

export async function DELETE(
  request: Request,
  context: { params: Promise<LibraryEntryParams> }
) {
  const path = appendForwardedQuery(
    entryPath(await context.params),
    request,
    ["expectedVersion"]
  );
  return proxyDelete(path);
}
