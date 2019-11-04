/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Project, projectUtils } from "@atomist/automation-client";
import { AspectWithReportDetails } from "@atomist/sdm-pack-aspect";
import { sha256 } from "@atomist/sdm-pack-fingerprint";
import { FP } from "@atomist/sdm-pack-fingerprint/lib/machine/Aspect";

export interface LanguageSummary {
  present: "true";
}
export type languageTestCheck = (p: Project) => Promise<boolean>;
export interface LanguageTest {
  name: string;
  test: languageTestCheck;
}

export function languageAspect(tests: LanguageTest[]): AspectWithReportDetails<LanguageSummary> {
  const languageSummaryName = "languageSummary";
  return {
    name: languageSummaryName,
    displayName: "Language Usage",
    toDisplayableFingerprint: fp => fp.data.present && "true",
    toDisplayableFingerprintName: fp => fp,
    extract: async p => {
      const fps: Array<FP<LanguageSummary>> = [];
      for (const t of tests) {
        const result = await runLanguageTest(p, t.test);
        if (result) {
          const data: LanguageSummary = { present: "true" };
          fps.push({
            name: t.name,
            type: languageSummaryName,
            data,
            abbreviation: "langs",
            version: "0.0.1",
            sha: sha256(JSON.stringify({data})),
          });
        }
      }

      return fps;
    },
    details: {
      description: "Language Summary",
      shortName: "language-summary",
      unit: "language-summary",
      category: "Language Summary",
      url: `fingerprint/${languageSummaryName}/*?byOrg=true&trim=false`,
      manage: false,
    },
  };
}

type languageTest = (p: Project) => Promise<boolean>;
async function runLanguageTest(p: Project, test: languageTest): Promise<boolean> {
  return test(p);
}

/**
 * Identify common languages
 */
export const languageTests: LanguageTest[] = [
  {
    name: "c-lang",
    test: async p => projectUtils.fileExists(p, "**/*.[cC]"),
  },
  {
    name: "c#",
    test: async p => projectUtils.fileExists(p, "**/*.cs"),
  },
  {
    name: "c++",
    test: async p => projectUtils.fileExists(p, "**/*.@(cpp|hpp|cxx|CC)"),
  },
  {
    name: "clojure",
    test: async p => projectUtils.fileExists(p, "**/*.@(clj|cljs|cljx)"),
  },
  {
    name: "css",
    test: async p => projectUtils.fileExists(p, "**/*.@(css|sass|scss|less)"),
  },
  {
    name: "dart",
    test: async p => projectUtils.fileExists(p, "**/*.dart"),
  },
  {
    name: "elixir",
    test: async p => projectUtils.fileExists(p, "**/*.@(ex|exs)"),
  },
  {
    name: "golang",
    test: async p => projectUtils.fileExists(p, "**/*.go"),
  },
  {
    name: "html",
    test: async p => projectUtils.fileExists(p, "**/*.@(htm|html)"),
  },
  {
    name: "java",
    test: async p => projectUtils.fileExists(p, "**/*.java"),
  },
  {
    name: "javascript",
    test: async p => projectUtils.fileExists(p, "**/*.js"),
  },
  {
    name: "kotlin",
    test: async p => projectUtils.fileExists(p, "**/*.@(kt|ktm|kts)"),
  },
  {
    name: "objective-c",
    test: async p => projectUtils.fileExists(p, "**/*.@(m|mm|M)"),
  },
  {
    name: "php",
    test: async p => projectUtils.fileExists(p, "**/*.php"),
  },
  {
    name: "python",
    test: async p => p.hasFile("requirements.txt"),
  },
  {
    name: "python",
    test: async p => projectUtils.fileExists(p, "**/*.py"),
  },
  {
    name: "r-lang",
    test: async p => projectUtils.fileExists(p, "**/*.r"),
  },
  {
    name: "ruby",
    test: async p => projectUtils.fileExists(p, "**/*.rb"),
  },
  {
    name: "rust",
    test: async p => projectUtils.fileExists(p, "**/*.@(rs|rlib)"),
  },
  {
    name: "scala",
    test: async p => projectUtils.fileExists(p, "**/*.@(scala|sc)"),
  },
  {
    name: "swift",
    test: async p => projectUtils.fileExists(p, "**/*.swift"),
  },
  {
    name: "typescript",
    test: async p => projectUtils.fileExists(p, "**/*.ts"),
  },
  {
    name: "vba",
    test: async p => projectUtils.fileExists(p, "**/*.vba"),
  },
  {
    name: "web-assembly",
    test: async p => projectUtils.fileExists(p, "**/*.@(wat|wasm)"),
  },
];
