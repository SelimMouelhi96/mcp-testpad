const BASE_URL = "https://api.testpad.com/api/v1";

export class TestPadClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    let url = `${BASE_URL}${path}`;
    if (params && Object.keys(params).length > 0) {
      url += `?${new URLSearchParams(params).toString()}`;
    }
    const headers: Record<string, string> = {
      Authorization: `apikey ${this.token}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `TestPad API error ${response.status}: ${response.statusText} - ${text}`
      );
    }

    return response.json() as Promise<T>;
  }

  // Projects
  async listProjects() {
    return this.request<unknown>("GET", "/projects");
  }

  async getProject(projectId: number) {
    return this.request<unknown>("GET", `/projects/${projectId}`);
  }

  // Folders
  async getFolders(projectId: number, params?: Record<string, string>) {
    return this.request<unknown>("GET", `/projects/${projectId}/folders`, undefined, params);
  }

  async getFolder(projectId: number, folderId: string, params?: Record<string, string>) {
    return this.request<unknown>(
      "GET",
      `/projects/${projectId}/folders/${folderId}`,
      undefined,
      params
    );
  }

  async createFolder(projectId: number, data: { name: string }) {
    return this.request<unknown>(
      "POST",
      `/projects/${projectId}/folders`,
      data
    );
  }

  async createSubfolder(
    projectId: number,
    folderId: string,
    data: { name: string }
  ) {
    return this.request<unknown>(
      "POST",
      `/projects/${projectId}/folders/${folderId}/folders`,
      data
    );
  }

  async modifyFolder(
    projectId: number,
    folderId: string,
    data: { name?: string }
  ) {
    return this.request<unknown>(
      "PATCH",
      `/projects/${projectId}/folders/${folderId}`,
      data
    );
  }

  // Scripts
  async createScript(projectId: number, data: unknown) {
    return this.request<unknown>(
      "POST",
      `/projects/${projectId}/scripts`,
      data
    );
  }

  async createScriptInFolder(
    projectId: number,
    folderId: string,
    data: unknown
  ) {
    return this.request<unknown>(
      "POST",
      `/projects/${projectId}/folders/${folderId}/scripts`,
      data
    );
  }

  async getScript(scriptId: number, params?: Record<string, string>) {
    return this.request<unknown>("GET", `/scripts/${scriptId}`, undefined, params);
  }

  // Test Runs
  async addTestRun(
    scriptId: number,
    data: {
      headers?: Record<string, string>;
      results?: Record<string, unknown>;
      completed?: boolean | "auto";
    }
  ) {
    return this.request<unknown>("POST", `/scripts/${scriptId}/runs`, data);
  }

  // Notes
  async getProjectNotes(projectId: number) {
    return this.request<unknown>("GET", `/projects/${projectId}/notes`);
  }

  async getFolderNotes(projectId: number, folderId: string) {
    return this.request<unknown>(
      "GET",
      `/projects/${projectId}/folders/${folderId}/notes`
    );
  }

  async createProjectNote(projectId: number, data: { content: string }) {
    return this.request<unknown>(
      "POST",
      `/projects/${projectId}/notes`,
      data
    );
  }

  async createFolderNote(
    projectId: number,
    folderId: string,
    data: { content: string }
  ) {
    return this.request<unknown>(
      "POST",
      `/projects/${projectId}/folders/${folderId}/notes`,
      data
    );
  }

  async modifyNote(
    projectId: number,
    noteId: string,
    data: { content?: string }
  ) {
    return this.request<unknown>(
      "PATCH",
      `/projects/${projectId}/notes/${noteId}`,
      data
    );
  }
}
