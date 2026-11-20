// Kleiner GitHub-REST-Client für das Termin-Formular (GraphQL wird bewusst nicht genutzt).
// Token: fein granulares Token nur für dieses Repo (Secret GITHUB_TOKEN, siehe docs/termin-formular.md).

export class GithubFehler extends Error {
  constructor(public status: number, public antwort: string, public schritt: string) {
    super(`GitHub ${schritt}: ${status} ${antwort.slice(0, 300)}`);
  }
}

export interface Datei {
  pfad: string;
  // genau eins davon: Text, Bild (Base64), vorhandener Blob (Kopie), null = löschen
  text?: string;
  base64?: string;
  blob?: string;
  loeschen?: true;
}

export class Github {
  constructor(private token: string, private repo: string) {}

  async api<T = any>(schritt: string, pfad: string, init: { method?: string; body?: unknown; accept?: string } = {}): Promise<T> {
    const r = await fetch(`https://api.github.com/repos/${this.repo}${pfad}`, {
      method: init.method ?? 'GET',
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: init.accept ?? 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'selbst-gemacht-termin-formular',
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (r.status === 204) return undefined as T;
    if (!r.ok) throw new GithubFehler(r.status, await r.text(), schritt);
    if (init.accept === 'application/vnd.github.raw') return (await r.arrayBuffer()) as T;
    return (await r.json()) as T;
  }

  // Commit-SHA eines Branches oder null, wenn es ihn nicht gibt
  async branchSha(branch: string): Promise<string | null> {
    try {
      const r = await this.api<{ object: { sha: string } }>('Branch lesen', `/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, '/')}`);
      return r.object.sha;
    } catch (e) {
      if (e instanceof GithubFehler && e.status === 404) return null;
      throw e;
    }
  }

  // Datei als Text lesen; null, wenn es sie auf diesem Stand nicht gibt
  async text(pfad: string, ref: string): Promise<string | null> {
    try {
      const buf = await this.api<ArrayBuffer>('Datei lesen', `/contents/${pfad}?ref=${encodeURIComponent(ref)}`, { accept: 'application/vnd.github.raw' });
      return new TextDecoder().decode(buf);
    } catch (e) {
      if (e instanceof GithubFehler && e.status === 404) return null;
      throw e;
    }
  }

  async roh(pfad: string, ref: string): Promise<ArrayBuffer | null> {
    try {
      return await this.api<ArrayBuffer>('Datei lesen', `/contents/${pfad}?ref=${encodeURIComponent(ref)}`, { accept: 'application/vnd.github.raw' });
    } catch (e) {
      if (e instanceof GithubFehler && e.status === 404) return null;
      throw e;
    }
  }

  // Blob-SHA einer Datei (für Kopien ohne erneutes Hochladen)
  async blobSha(pfad: string, ref: string): Promise<string | null> {
    try {
      const r = await this.api<{ sha: string; type: string }>('Datei prüfen', `/contents/${pfad}?ref=${encodeURIComponent(ref)}`);
      return r.type === 'file' ? r.sha : null;
    } catch (e) {
      if (e instanceof GithubFehler && e.status === 404) return null;
      throw e;
    }
  }

  // Alle Änderungen als EIN Commit auf `branch`; legt den Branch von `basis` an, wenn es ihn nicht gibt.
  async commit(branch: string, basis: string, nachricht: string, dateien: Datei[]): Promise<string> {
    const vorhanden = await this.branchSha(branch);
    const eltern = vorhanden ?? (await this.branchSha(basis));
    if (!eltern) throw new GithubFehler(404, `Branch ${basis} fehlt`, 'Basis lesen');
    const elternCommit = await this.api<{ tree: { sha: string } }>('Commit lesen', `/git/commits/${eltern}`);

    const baum = [];
    for (const d of dateien) {
      if (d.loeschen) baum.push({ path: d.pfad, mode: '100644', type: 'blob', sha: null });
      else if (d.text !== undefined) baum.push({ path: d.pfad, mode: '100644', type: 'blob', content: d.text });
      else if (d.blob) baum.push({ path: d.pfad, mode: '100644', type: 'blob', sha: d.blob });
      else if (d.base64) {
        const b = await this.api<{ sha: string }>('Bild hochladen', '/git/blobs', { method: 'POST', body: { content: d.base64, encoding: 'base64' } });
        baum.push({ path: d.pfad, mode: '100644', type: 'blob', sha: b.sha });
      }
    }
    const tree = await this.api<{ sha: string }>('Baum anlegen', '/git/trees', { method: 'POST', body: { base_tree: elternCommit.tree.sha, tree: baum } });
    const c = await this.api<{ sha: string }>('Commit anlegen', '/git/commits', { method: 'POST', body: { message: nachricht, tree: tree.sha, parents: [eltern] } });
    if (vorhanden) await this.api('Branch fortschreiben', `/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: c.sha, force: false } });
    else await this.api('Branch anlegen', '/git/refs', { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: c.sha } });
    return c.sha;
  }

  async offenerPr(branch: string): Promise<{ number: number; title: string } | null> {
    const owner = this.repo.split('/')[0];
    const l = await this.api<any[]>('Pull Request suchen', `/pulls?state=open&head=${encodeURIComponent(owner + ':' + branch)}`);
    return l[0] ? { number: l[0].number, title: l[0].title } : null;
  }

  async prAnlegenOderAktualisieren(branch: string, titel: string, text: string): Promise<number> {
    const pr = await this.offenerPr(branch);
    if (pr) {
      if (pr.title !== titel) await this.api('Pull Request umbenennen', `/pulls/${pr.number}`, { method: 'PATCH', body: { title: titel } });
      return pr.number;
    }
    const neu = await this.api<{ number: number }>('Pull Request anlegen', '/pulls', { method: 'POST', body: { title: titel, head: branch, base: 'main', body: text } });
    return neu.number;
  }
}
