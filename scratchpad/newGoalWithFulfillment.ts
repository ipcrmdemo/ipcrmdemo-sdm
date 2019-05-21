// const myFirstGoal = new GoalWithFulfillment({
//   uniqueName: "myFirstGoal",
//   displayName: "myFirstGoalDisplayName",
//   environment: IndependentOfEnvironment,
// }).with({
//   name: "myFirstFulfilment",
//   goalExecutor: async gi => {
//     if (gi.sdmGoal.push.after.message.includes("fail me")) {
//       return {
//         code: 1,
//       };
//     }
//     return gi.configuration.sdm.projectLoader.doWithProject({
//       credentials: gi.credentials,
//       id: gi.id,
//       readOnly: true,
//     }, async p => {
//       const f = await p.getFile("package.json");
//       const pj = JSON.parse(f.getContentSync());
//       await gi.context.messageClient.addressChannels(
//         `Node version ${pj.engines.node}`,
//         gi.sdmGoal.push.repo.channels[0].name);
//
//     });
//   },
// });
