// sdm.addCommand<{ name: string }>({
//     name: "hello",
//     intent: "hello",
//     parameters: {
//         name: { description: "Your name" },
//     },
//     listener: async cli => cli.addressChannels(`Hello ${cli.parameters.name}`),
// });
// https://icanhazdadjoke.com/
// const httpClient = configurationValue<HttpClientFactory>("http.client.factory").create();

// sdm.addCommand({
//   name: "myNewCommand",
//   intent: "dad joke please",
//   listener: async ci => {
//     const giphyKey = configurationValue<string>("giphy_key");
//     const httpClient = configurationValue<HttpClientFactory>("http.client.factory").create();
//     const joke = await httpClient.exchange<{id: string, joke: string}>("https://icanhazdadjoke.com/", {
//       headers: {
//         "Content-Type": "application/json",
//         "Accept": "application/json",
//       },
//     });
//
//     interface GiphyImage {
//       images: {
//         fixed_height: {
//           url: string;
//         };
//       };
//     }
//     const image = await httpClient.exchange<{
//       data: GiphyImage,
//     }>(`http://api.giphy.com/v1/gifs/random?tag=laughing&api_key=${giphyKey}&limit=1`);
//
//     await ci.addressChannels({
//       attachments: [
//         {
//           text: `${joke.body.joke}`,
//           fallback: "hi",
//           image_url: image.body.data.images.fixed_height.url,
//         },
//       ],
//     });
//   },
// });
