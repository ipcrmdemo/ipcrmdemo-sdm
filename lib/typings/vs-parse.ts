declare module "vs-parse" {
  export interface ParseProjectOptions {
    deepParse?: boolean;
    dirRoot?: string;
  }
  export interface Package {
    name: string;
    version: string;
    targetFramework: string;
  }
  export interface CodeFile {
    fileName: string;
  }
  export interface ParseProjectReturn {
    codeFiles: CodeFile[];
    packages: Package[];
    references: Array<Record<string, string>>;
  }
  export function parsePackages(filePath: string): Promise<Package[]>;
  export function parseProject(filePath: string, options?: ParseProjectOptions): Promise<ParseProjectReturn>;
}
