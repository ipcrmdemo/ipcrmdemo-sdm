import { astUtils, InMemoryProject, Project } from "@atomist/automation-client";
import {FP} from "@atomist/sdm-pack-fingerprint";
import * as _ from "lodash";
import * as assert from "power-assert";
import {DotNetPackageProperties, DotNetPackageAspect} from "../../lib/support/aspects/dotNetPackage";
import { XmldocFileParser } from "@atomist/sdm-pack-spring/lib/xml/XmldocFileParser";

describe("dotNetTargetPackageAspect", () => {
  it("should extract package fps from packages.config", async () => {
    const p = InMemoryProject.of({ path: "packages.config", content: packagesConfig});
    const result = await DotNetPackageAspect.extract(p, {} as any);
    const names = (result as Array<FP<DotNetPackageProperties>>).map(pack => pack.name);
    assert.strictEqual(names.length, 2);
    assert(names.includes("Common.Logging") && names.includes("Common.Logging.Core"));
  });
  it("should extract package fps from csproj files", async () => {
    const p = InMemoryProject.of({ path: "example.csproj", content: exampleCsProj});
    const result = await DotNetPackageAspect.extract(p, {} as any);
    const names = (result as Array<FP<DotNetPackageProperties>>).map(pack => pack.name);
    assert.strictEqual(names.length, 4);
    assert(
      names.includes("Microsoft.AspNetCore") &&
      names.includes("Microsoft.AspNetCore.Mvc") &&
      names.includes("Microsoft.Extensions.Logging.Debug") &&
      names.includes("Microsoft.EntityFrameworkCore.SqlServer"),
    );
  });
  it("should apply an fp to packages.config", async () => {
    const p = InMemoryProject.of({ path: "packages.config", content: packagesConfig});
    const returnedP = await DotNetPackageAspect.apply(p, {
      parameters: {
        fp: {
          data: {
            name: "Common.Logging",
            version: "3.3.0",
          },
        },
      },
    } as any);

    let newValue: string;
    await astUtils.doWithAllMatches(
      (returnedP as Project),
      new XmldocFileParser(),
      ["packages.config", "**/packages.config"],
      `//packages/package`,
      m => {
        if ((m as any).id === "Common.Logging") {
          newValue = (m as any).xd.attr.version;
        }
      },
    );
    assert.strictEqual(newValue, "3.3.0");
  });
  it("should apply an fp to csproj file", async () => {
    const p = InMemoryProject.of({ path: "test.csproj", content: exampleCsProj});
    const returnedP = await DotNetPackageAspect.apply(p, {
      parameters: {
        fp: {
          data: {
            name: "Microsoft.AspNetCore",
            version: "1.1.2",
          },
        },
      },
    } as any);

    let newValue: string;
    await astUtils.doWithAllMatches(
      (returnedP as Project),
      new XmldocFileParser(),
      ["*.csproj", "**/*.csproj"],
      `//ItemGroup/PackageReference`,
      m => {
        if ((m as any).xd.attr.Include === "Microsoft.AspNetCore") {
          newValue = (m as any).xd.attr.Version;
        }
      },
    );
    assert.strictEqual(newValue, "1.1.2");
  });
});

const packagesConfig = `
<?xml version="1.0" encoding="utf-8"?>
<packages>
  <package id="Common.Logging" version="3.2.0" targetFramework="net452" />
  <package id="Common.Logging.Core" version="3.2.0" targetFramework="net452" />
</packages>
`;

const exampleCsProj = `
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>netcoreapp1.1</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <Folder Include="wwwroot\\" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore" Version="1.1.1" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc" Version="1.1.2" />
    <PackageReference Include="Microsoft.Extensions.Logging.Debug" Version="1.1.1" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="1.1.1" />
  </ItemGroup>
</Project>
`;
