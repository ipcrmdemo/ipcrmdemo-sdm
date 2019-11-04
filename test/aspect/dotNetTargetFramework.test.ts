import {InMemoryProject} from "@atomist/automation-client";
import {FP} from "@atomist/sdm-pack-fingerprint";
import * as assert from "power-assert";
import {
  DotNetTargetFrameworkProperties,
  DotNetTargetFrameworkAspect,
} from "../../lib/support/aspects/dotNetTargetFramework";

describe("dotNetTargetFrameworkAspect", () => {
  it("should extract framework fps from csproj file", async () => {
    const p = InMemoryProject.of({ path: "packages.csproj", content: exampleCsProj});
    const result = await DotNetTargetFrameworkAspect.extract(p, {} as any);
    const target = (result as FP<DotNetTargetFrameworkProperties>).data.target;
    assert.strictEqual(target, "netcoreapp1.1");
  });
});

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
