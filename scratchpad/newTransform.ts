// export const AddApacheLicenseFileTransform: CodeTransform<NoParameters> = async (p: Project) => {
//   const httpClient = DefaultHttpClientFactory.create();
//   const license = await httpClient.exchange("https://www.apache.org/licenses/LICENSE-2.0.txt");
//   return p.addFile("LICENSE", license.body as string);
// };
// export const AddApacheLicenseFile: CodeTransformRegistration<NoParameters> = {
//   transform: AddApacheLicenseFileTransform,
//   name: "add apache license file",
//   description: `Add Apache 2.0 license file`,
//   intent: ["add apache license file", "add license file"],
// };
//
// OR PR version
//
// export const AddApacheLicenseFile: CodeTransformRegistration<AddApacheLicenseFileParameters> = {
//   transform: AddApacheLicenseFileTransform,
//   paramsMaker: AddApacheLicenseFileParameters,
//   name: "add apache license file",
//   description: `Add Apache 2.0 license file`,
//   intent: ["add apache license file", "add license file"],
//   transformPresentation: () => new editModes.PullRequest("license-file", "Add license file"),
// };
//
// As an Autofix
//
// export const AddApacheLicenseFileAutofix: AutofixRegistration = {
//   name: "add apache license file",
//   transform: AddApacheLicenseFileTransform,
//   pushTest: not(hasFile("LICENSE")),
//   options: {
//     ignoreFailure: false,
//     considerOnlyChangedFiles: false,
//   },
// };
