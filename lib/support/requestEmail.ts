import { CommandHandlerRegistration, CommandListenerInvocation} from "@atomist/sdm";
import {
  BaseParameter,
  configurationValue,
  HandlerResult, HttpClientFactory, HttpMethod, logger, MappedParameter,
  MappedParameters,
  Parameter,
  Parameters
} from "@atomist/automation-client";
import { createReqSlackMessage } from "../events/onScRequest";

const validation: BaseParameter = {
  type: "string",
  required: true,
};

const trueFalse: BaseParameter = {
  ...validation,
  type: {
    kind: "single",
    options: [
      { value: "true", description: "Yes" },
      { value: "false", description: "No" },
    ],
  },
}

@Parameters()
export class RequestEmailParams {
  @MappedParameter(MappedParameters.SlackUserName, true)
  public screenName: string;

  @Parameter({
      type: {
        kind: "single",
        options: [
          { value: "red", description: "Red" },
          { value: "blue", description: "Blue" },
        ],
      },
      group: {
        name: "FOO",
        description: "FOO",
      },
  })
  public thing: string;

  @Parameter({
    description: `Desired New Email address`,
    ...trueFalse,
  })
  public emailAddress: string;
}
export interface SnowOptions {
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
        body: {
            new_email: cli.parameters.emailAddress,
            atomist_screen_name: cli.parameters.screenName,
        },
        options: {
          auth: {
            username: snow.user,
            password: snow.password,
          },
        },
      },
    )
      .then(async result => {
        interface ScResult {
          request_number: string;
          request_id: string;
        }
        interface ScResultBody {
          result: ScResult;
        }
        const scData = result.body as ScResultBody;

        await cli.addressChannels(
          createReqSlackMessage(
            scData.result.request_number,
            `1`,
            cli.parameters.screenName,
          ),
          {
            id: `service-now-req/${scData.result.request_number}`,
            ttl: 60 * 60 * 1000, // update this message for up to one hour; after that, post anew
          },
        );

        resolve({
          code: 0,
          message: JSON.stringify(result.body, undefined, 2),
        });
      })
      .catch(e => {
        const error = `SNOW: Failed to create request: ${e}`;
        logger.error(error);
        reject({
          code: 1,
          message: error,
        });
      });
  });
};

export const requestNewEmail: CommandHandlerRegistration<RequestEmailParams> = {
  name: "requestNewEmail",
  paramsMaker: RequestEmailParams,
  intent: "request email",
  listener: requestNewEmailHandler,
  autoSubmit: false,
};
