import { CommandHandlerRegistration, CommandListenerInvocation, slackSuccessMessage } from "@atomist/sdm";
import {
  BaseParameter,
  configurationValue,
  HandlerResult, HttpClientFactory, HttpMethod, logger,
  MappedParameter,
  MappedParameters,
  Parameter,
  Parameters
} from "@atomist/automation-client";
import { codeBlock } from "@atomist/slack-messages";

const validation: BaseParameter = {
  type: "string",
  required: true,
};

@Parameters()
export class RequestEmailParams {
  @MappedParameter(MappedParameters.SlackUserName)
  public screenName: string;

  @Parameter({
    description: `Desired New Email address`,
    ...validation,
  })
  public emailAddress: string;
}
interface SnowOptions {
  url: string;
  user: string;
  password: string;
  newEmailURI: string;
}
export async function requestNewEmailHandler(
  cli: CommandListenerInvocation<RequestEmailParams>): Promise<HandlerResult> {
  return new Promise<HandlerResult>(async (resolve, reject) => {
    const httpClient = configurationValue<HttpClientFactory>("http.client.factory").create();
    const snow = configurationValue<SnowOptions>("sdm.snow");
    await httpClient.exchange(
      snow.url + snow.newEmailURI,
      {
        method: HttpMethod.Post,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        options: {
          body: JSON.stringify({
            sysparm_quantity: 1,
            variables: {
              new_email: cli.parameters.emailAddress,
              atomist_screen_name: cli.parameters.screenName
            }
          }),
          auth: {
            username: snow.user,
            password: snow.password
          }
        }
      }
    )
      .then(async result => {
        await cli.addressChannels(slackSuccessMessage(
          `SNOW Request`,
          `Successfully created new request, ${codeBlock(JSON.stringify(result.body, undefined, 2))}`
        ));
        resolve({
          code: 0,
          message: JSON.stringify(result.body, undefined, 2)
        });
      })
      .catch(e => {
        const error = `SNOW: Failed to create request: ${e}`;
        logger.error(error);
        reject({
          code: 1,
          message: error
        });
      });
  });
};

export const requestNewEmail: CommandHandlerRegistration<RequestEmailParams> = {
  name: "requestNewEmail",
  paramsMaker: RequestEmailParams,
  intent: "request email",
  listener: requestNewEmailHandler
};
