# Computer use (beta)

Claude 4 Opus and Sonnet, along with Claude Sonnet 3.7 and Claude Sonnet 3.5 (new), are capable of interacting with [tools](/en/docs/build-with-claude/tool-use) that can manipulate a computer desktop environment. Claude 4 models use updated tool versions optimized for the new architecture. Claude Sonnet 3.7 introduces additional tools and allows you to enable thinking, giving you more insight into the model's reasoning process.

<Warning>
  Computer use is a beta feature. Please be aware that computer use poses unique risks that are distinct from standard API features or chat interfaces. These risks are heightened when using computer use to interact with the internet. To minimize risks, consider taking precautions such as:

  1. Use a dedicated virtual machine or container with minimal privileges to prevent direct system attacks or accidents.
  2. Avoid giving the model access to sensitive data, such as account login information, to prevent information theft.
  3. Limit internet access to an allowlist of domains to reduce exposure to malicious content.
  4. Ask a human to confirm decisions that may result in meaningful real-world consequences as well as any tasks requiring affirmative consent, such as accepting cookies, executing financial transactions, or agreeing to terms of service.

  In some circumstances, Claude will follow commands found in content even if it conflicts with the user's instructions. For example, Claude instructions on webpages or contained in images may override instructions or cause Claude to make mistakes. We suggest taking precautions to isolate Claude from sensitive data and actions to avoid risks related to prompt injection.

  We’ve trained the model to resist these prompt injections and have added an extra layer of defense. If you use our computer use tools, we’ll automatically run classifiers on your prompts to flag potential instances of prompt injections. When these classifiers identify potential prompt injections in screenshots, they will automatically steer the model to ask for user confirmation before proceeding with the next action. We recognize that this extra protection won’t be ideal for every use case (for example, use cases without a human in the loop), so if you’d like to opt out and turn it off, please [contact us](https://support.anthropic.com/en/).

  We still suggest taking precautions to isolate Claude from sensitive data and actions to avoid risks related to prompt injection.

  Finally, please inform end users of relevant risks and obtain their consent prior to enabling computer use in your own products.
</Warning>

<Card title="Computer use reference implementation" icon="computer" href="https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo">
  Get started quickly with our computer use reference implementation that includes a web interface, Docker container, example tool implementations, and an agent loop.

  **Note:** The implementation has been updated to include new tools for both Claude 4 and Claude Sonnet 3.7. Be sure to pull the latest version of the repo to access these new features.
</Card>

<Tip>
  Please use [this form](https://forms.gle/BT1hpBrqDPDUrCqo7) to provide
  feedback on the quality of the model responses, the API itself, or the quality
  of the documentation - we cannot wait to hear from you!
</Tip>

Here's an example of how to provide computer use tools to Claude using the Messages API:

<Tabs>
  <Tab title="Claude 4">
    <CodeGroup>
      ```bash Shell
      curl https://api.anthropic.com/v1/messages \
        -H "content-type: application/json" \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "anthropic-beta: computer-use-2025-01-24" \
        -d '{
          "model": "claude-4-opus-20250514",
          "max_tokens": 2000,
          "tools": [
            {
              "type": "computer_20250124",
              "name": "computer",
              "display_width_px": 1024,
              "display_height_px": 768,
              "display_number": 1
            },
            {
              "type": "text_editor_20250429",
              "name": "str_replace_based_edit_tool"
            },
            {
              "type": "bash_20250124",
              "name": "bash"
            }
          ],
          "messages": [
            {
              "role": "user",
              "content": "Save a picture of a cat to my desktop."
            }
          ],
          "thinking": {
            "type": "enabled",
            "budget_tokens": 1024
          }
        }'
      ```

      ```Python Python
      import anthropic

      client = anthropic.Anthropic()

      response = client.beta.messages.create(
          model="claude-4-opus-20250514",
          max_tokens=1024,
          tools=[
              {
                "type": "computer_20250124",
                "name": "computer",
                "display_width_px": 1024,
                "display_height_px": 768,
                "display_number": 1,
              },
              {
                "type": "text_editor_20250429",
                "name": "str_replace_based_edit_tool"
              },
              {
                "type": "bash_20250124",
                "name": "bash"
              }
          ],
          messages=[{"role": "user", "content": "Save a picture of a cat to my desktop."}],
          betas=["computer-use-2025-01-24"],
          thinking={"type": "enabled", "budget_tokens": 1024}
      )
      print(response)
      ```

      ```TypeScript TypeScript
      import Anthropic from '@anthropic-ai/sdk';

      const anthropic = new Anthropic();

      const message = await anthropic.beta.messages.create({
        model: "claude-4-opus-20250514",
        max_tokens: 1024,
        tools: [
            {
              type: "computer_20250124",
              name: "computer",
              display_width_px: 1024,
              display_height_px: 768,
              display_number: 1
            },
            {
              type: "text_editor_20250429",
              name: "str_replace_based_edit_tool"
            },
            {
              type: "bash_20250124",
              name: "bash"
            }
        ],
        messages: [{ role: "user", content: "Save a picture of a cat to my desktop." }],
        betas: ["computer-use-2025-01-24"],
        thinking: { type: "enabled", budget_tokens": 1024 }
      });
      console.log(message);
      ```

      ```java Java
      import com.anthropic.client.AnthropicClient;
      import com.anthropic.client.okhttp.AnthropicOkHttpClient;
      import com.anthropic.models.beta.messages.BetaMessage;
      import com.anthropic.models.beta.messages.MessageCreateParams;
      import com.anthropic.models.beta.messages.BetaToolBash20250429;
      import com.anthropic.models.beta.messages.BetaToolComputerUse20250429;
      import com.anthropic.models.beta.messages.BetaToolStrReplaceBasedEditTool20250429;
      import com.anthropic.models.beta.messages.BetaThinkingConfigEnabled;
      import com.anthropic.models.messages.Model;

      public class ComputerUseExample {

          public static void main(String[] args) {
              AnthropicClient client = AnthropicOkHttpClient.fromEnv();

              MessageCreateParams params = MessageCreateParams.builder()
                      .model(Model.CLAUDE_4_OPUS_LATEST)
                      .maxTokens(1024)
                      .addTool(BetaToolComputerUse20250429.builder()
                              .displayWidthPx(1024)
                              .displayHeightPx(768)
                              .displayNumber(1)
                              .build())
                      .addTool(BetaToolStrReplaceBasedEditTool20250429.builder()
                              .build())
                      .addTool(BetaToolBash20250429.builder()
                              .build())
                      .addUserMessage("Save a picture of a cat to my desktop.")
                      .thinking(BetaThinkingConfigEnabled.builder()
                              .budgetTokens(1024)
                              .build())
                      .addBeta("computer-use-2025-01-24")
                      .build();

              BetaMessage message = client.beta().messages().create(params);
              System.out.println(message);
          }
      }
      ```
    </CodeGroup>
  </Tab>

  <Tab title="Claude Sonnet 3.7">
    <CodeGroup>
      ```bash Shell
      curl https://api.anthropic.com/v1/messages \
        -H "content-type: application/json" \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "anthropic-beta: computer-use-2025-01-24" \
        -d '{
          "model": "claude-3-7-sonnet-20250219",
          "max_tokens": 1024,
          "tools": [
            {
              "type": "computer_20250124",
              "name": "computer",
              "display_width_px": 1024,
              "display_height_px": 768,
              "display_number": 1
            },
            {
              "type": "text_editor_20250124",
              "name": "str_replace_editor"
            },
            {
              "type": "bash_20250124",
              "name": "bash"
            }
          ],
          "messages": [
            {
              "role": "user",
              "content": "Save a picture of a cat to my desktop."
            }
          ],
          "thinking": {
            "type": "enabled",
            "budget_tokens": 1024
          }
        }'
      ```

      ```Python Python
      import anthropic

      client = anthropic.Anthropic()

      response = client.beta.messages.create(
          model="claude-3-7-sonnet-20250219",
          max_tokens=1024,
          tools=[
              {
                "type": "computer_20250124",
                "name": "computer",
                "display_width_px": 1024,
                "display_height_px": 768,
                "display_number": 1,
              },
              {
                "type": "text_editor_20250124",
                "name": "str_replace_editor"
              },
              {
                "type": "bash_20250124",
                "name": "bash"
              }
          ],
          messages=[{"role": "user", "content": "Save a picture of a cat to my desktop."}],
          betas=["computer-use-2025-01-24"],
          thinking={"type": "enabled", "budget_tokens": 1024}
      )
      print(response)
      ```

      ```TypeScript TypeScript
      import Anthropic from '@anthropic-ai/sdk';

      const anthropic = new Anthropic();

      const message = await anthropic.beta.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 1024,
        tools: [
            {
              type: "computer_20250124",
              name: "computer",
              display_width_px: 1024,
              display_height_px: 768,
              display_number: 1
            },
            {
              type: "text_editor_20250124",
              name: "str_replace_editor"
            },
            {
              type: "bash_20250124",
              name: "bash"
            }
        ],
        messages: [{ role: "user", content: "Save a picture of a cat to my desktop." }],
        betas: ["computer-use-2025-01-24"],
        thinking: { type: "enabled", budget_tokens": 1024 }
      });
      console.log(message);
      ```

      ```java Java
      import com.anthropic.client.AnthropicClient;
      import com.anthropic.client.okhttp.AnthropicOkHttpClient;
      import com.anthropic.models.beta.messages.BetaMessage;
      import com.anthropic.models.beta.messages.MessageCreateParams;
      import com.anthropic.models.beta.messages.BetaToolBash20250124;
      import com.anthropic.models.beta.messages.BetaToolComputerUse20250124;
      import com.anthropic.models.beta.messages.BetaToolTextEditor20250124;
      import com.anthropic.models.beta.messages.BetaThinkingConfigEnabled;
      import com.anthropic.models.messages.Model;

      public class ComputerUseExample {

          public static void main(String[] args) {
              AnthropicClient client = AnthropicOkHttpClient.fromEnv();

              MessageCreateParams params = MessageCreateParams.builder()
                      .model(Model.CLAUDE_3_7_SONNET_LATEST)
                      .maxTokens(1024)
                      .addTool(BetaToolComputerUse20250124.builder()
                              .displayWidthPx(1024)
                              .displayHeightPx(768)
                              .displayNumber(1)
                              .build())
                      .addTool(BetaToolTextEditor20250124.builder()
                              .build())
                      .addTool(BetaToolBash20250124.builder()
                              .build())
                      .addUserMessage("Save a picture of a cat to my desktop.")
                      .thinking(BetaThinkingConfigEnabled.builder()
                              .budgetTokens(1024)
                              .build())
                      .addBeta("computer-use-2025-01-24")
                      .build();

              BetaMessage message = client.beta().messages().create(params);
              System.out.println(message);
          }
      }
      ```
    </CodeGroup>
  </Tab>
</Tabs>

***

## How computer use works

<Steps>
  <Step title="1. Provide Claude with computer use tools and a user prompt" icon="toolbox">
    * Add Anthropic-defined computer use tools to your API request.
    * Include a user prompt that might require these tools, e.g., "Save a picture of a cat to my desktop."
  </Step>

  <Step title="2. Claude decides to use a tool" icon="screwdriver-wrench">
    * Claude loads the stored computer use tool definitions and assesses if any tools can help with the user's query.
    * If yes, Claude constructs a properly formatted tool use request.
    * The API response has a `stop_reason` of `tool_use`, signaling Claude's intent.
  </Step>

  <Step title="3. Extract tool input, evaluate the tool on a computer, and return results" icon="computer">
    * On your end, extract the tool name and input from Claude's request.
    * Use the tool on a container or Virtual Machine.
    * Continue the conversation with a new `user` message containing a `tool_result` content block.
  </Step>

  <Step title="4. Claude continues calling computer use tools until it's completed the task" icon="arrows-spin">
    * Claude analyzes the tool results to determine if more tool use is needed or the task has been completed.
    * If Claude decides it needs another tool, it responds with another `tool_use` `stop_reason` and you should return to step 3.
    * Otherwise, it crafts a text response to the user.
  </Step>
</Steps>

We refer to the repetition of steps 3 and 4 without user input as the "agent loop" - i.e., Claude responding with a tool use request and your application responding to Claude with the results of evaluating that request.

### The computing environment

Computer use requires a sandboxed computing environment where Claude can safely interact with applications and the web. This environment includes:

1. **Virtual display**: A virtual X11 display server (using Xvfb) that renders the desktop interface Claude will see through screenshots and control with mouse/keyboard actions.

2. **Desktop environment**: A lightweight UI with window manager (Mutter) and panel (Tint2) running on Linux, which provides a consistent graphical interface for Claude to interact with.

3. **Applications**: Pre-installed Linux applications like Firefox, LibreOffice, text editors, and file managers that Claude can use to complete tasks.

4. **Tool implementations**: Integration code that translates Claude's abstract tool requests (like "move mouse" or "take screenshot") into actual operations in the virtual environment.

5. **Agent loop**: A program that handles communication between Claude and the environment, sending Claude's actions to the environment and returning the results (screenshots, command outputs) back to Claude.

When you use computer use, Claude doesn't directly connect to this environment. Instead, your application:

1. Receives Claude's tool use requests
2. Translates them into actions in your computing environment
3. Captures the results (screenshots, command outputs, etc.)
4. Returns these results to Claude

For security and isolation, the reference implementation runs all of this inside a Docker container with appropriate port mappings for viewing and interacting with the environment.

***

## How to implement computer use

### Start with our reference implementation

We have built a [reference implementation](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo) that includes everything you need to get started quickly with computer use:

* A [containerized environment](https://github.com/anthropics/anthropic-quickstarts/blob/main/computer-use-demo/Dockerfile) suitable for computer use with Claude
* Implementations of [the computer use tools](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo/computer_use_demo/tools)
* An [agent loop](https://github.com/anthropics/anthropic-quickstarts/blob/main/computer-use-demo/computer_use_demo/loop.py) that interacts with the Anthropic API and executes the computer use tools
* A web interface to interact with the container, agent loop, and tools.

### Understanding the multi-agent loop

The core of computer use is the "agent loop" - a cycle where Claude requests tool actions, your application executes them, and returns results to Claude. Here's a simplified example:

```python
async def sampling_loop(
    *,
    model: str,
    messages: list[dict],
    api_key: str,
    max_tokens: int = 4096,
    tool_version: str,
    thinking_budget: int | None = None,
    max_iterations: int = 10,  # Add iteration limit to prevent infinite loops
):
    """
    A simple agent loop for Claude computer use interactions.

    This function handles the back-and-forth between:
    1. Sending user messages to Claude
    2. Claude requesting to use tools
    3. Your app executing those tools
    4. Sending tool results back to Claude
    """
    # Set up tools and API parameters
    client = Anthropic(api_key=api_key)
    beta_flag = "computer-use-2025-01-24" if "20250124" in tool_version else "computer-use-2024-10-22"

    # Configure tools - you should already have these initialized elsewhere
    tools = [
        {"type": f"computer_{tool_version}", "name": "computer", "display_width_px": 1024, "display_height_px": 768},
        {"type": f"text_editor_{tool_version}", "name": "str_replace_editor"},
        {"type": f"bash_{tool_version}", "name": "bash"}
    ]

    # Main agent loop (with iteration limit to prevent runaway API costs)
    iterations = 0
    while True and iterations < max_iterations:
        iterations += 1
        # Set up optional thinking parameter (for Claude Sonnet 3.7)
        thinking = None
        if thinking_budget:
            thinking = {"type": "enabled", "budget_tokens": thinking_budget}

        # Call the Claude API
        response = client.beta.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
            tools=tools,
            betas=[beta_flag],
            thinking=thinking
        )

        # Add Claude's response to the conversation history
        response_content = response.content
        messages.append({"role": "assistant", "content": response_content})

        # Check if Claude used any tools
        tool_results = []
        for block in response_content:
            if block.type == "tool_use":
                # In a real app, you would execute the tool here
                # For example: result = run_tool(block.name, block.input)
                result = {"result": "Tool executed successfully"}

                # Format the result for Claude
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result
                })

        # If no tools were used, Claude is done - return the final messages
        if not tool_results:
            return messages

        # Add tool results to messages for the next iteration with Claude
        messages.append({"role": "user", "content": tool_results})
```

The loop continues until either Claude responds without requesting any tools (task completion) or the maximum iteration limit is reached. This safeguard prevents potential infinite loops that could result in unexpected API costs.

<Warning>
  For each version of the tools, you must use the corresponding beta flag in
  your API request:

  <AccordionGroup>
    <Accordion title="Claude 4 beta flag">
      When using tools with `20250429` in their type (Claude 4 tools),
      include this beta flag: `"betas": ["computer-use-2025-01-24"]`
    </Accordion>

    <Accordion title="Claude Sonnet 3.7 beta flag">
      When using tools with `20250124` in their type (Claude Sonnet 3.7 tools),
      include this beta flag: `"betas": ["computer-use-2025-01-24"]` Note:
      The Bash (`bash_20250124`) and text editor (`text_editor_20250124`) tools
      are generally available for Claude Sonnet 3.5 (new) as well and can be
      used without the computer use beta header.
    </Accordion>

    <Accordion title="Claude Sonnet 3.5 (new) beta flag">
      When using tools with `20241022` in their type (Claude Sonnet 3.5 tools),
      include this beta flag: `"betas": ["computer-use-2024-10-22"]`
    </Accordion>
  </AccordionGroup>
</Warning>

We recommend trying the reference implementation out before reading the rest of this documentation.

### Optimize model performance with prompting

Here are some tips on how to get the best quality outputs:

1. Specify simple, well-defined tasks and provide explicit instructions for each step.
2. Claude sometimes assumes outcomes of its actions without explicitly checking their results. To prevent this you can prompt Claude with `After each step, take a screenshot and carefully evaluate if you have achieved the right outcome. Explicitly show your thinking: "I have evaluated step X..." If not correct, try again. Only when you confirm a step was executed correctly should you move on to the next one.`
3. Some UI elements (like dropdowns and scrollbars) might be tricky for Claude to manipulate using mouse movements. If you experience this, try prompting the model to use keyboard shortcuts.
4. For repeatable tasks or UI interactions, include example screenshots and tool calls of successful outcomes in your prompt.
5. If you need the model to log in, provide it with the username and password in your prompt inside xml tags like `<robot_credentials>`. Using computer use within applications that require login increases the risk of bad outcomes as a result of prompt injection. Please review our [guide on mitigating prompt injections](/en/docs/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks) before providing the model with login credentials.

<Tip>
  If you repeatedly encounter a clear set of issues or know in advance the tasks
  Claude will need to complete, use the system prompt to provide Claude with
  explicit tips or instructions on how to do the tasks successfully.
</Tip>

#### System prompts

When one of the Anthropic-defined tools is requested via the Anthropic API, a computer use-specific system prompt is generated. It's similar to the [tool use system prompt](/en/docs/build-with-claude/tool-use#tool-use-system-prompt) but starts with:

> You have access to a set of functions you can use to answer the user's question. This includes access to a sandboxed computing environment. You do NOT currently have the ability to inspect files or interact with external resources, except by invoking the below functions.

As with regular tool use, the user-provided `system_prompt` field is still respected and used in the construction of the combined system prompt.

### Understand Anthropic-defined tools

<Warning>As a beta, these tool definitions are subject to change.</Warning>

We have provided a set of tools that enable Claude to effectively use computers. When specifying an Anthropic-defined tool, `description` and `tool_schema` fields are not necessary or allowed.

<Note>
  **Anthropic-defined tools are user executed**

  Anthropic-defined tools are defined by Anthropic but you must explicitly evaluate the results of the tool and return the `tool_results` to Claude. As with any tool, the model does not automatically execute the tool.
</Note>

We provide a set of Anthropic-defined tools, with each tool having versions optimized for Claude 4, Claude Sonnet 3.7, and Claude Sonnet 3.5:

<AccordionGroup>
  <Accordion title="Claude 4 tools">
    The following tools are available for Claude 4 Opus and Sonnet:

    * `{ "type": "computer_20250124", "name": "computer" }` - Enhanced computer control with improved precision
    * `{ "type": "text_editor_20250429", "name": "str_replace_based_edit_tool" }` - Updated text editor without the `undo_edit` command
    * `{ "type": "bash_20250124", "name": "bash" }` - Enhanced bash shell with improved capabilities

    <Warning>
      The Claude 4 version of the text editor tool does not support the `undo_edit` command. Plan accordingly when designing your workflows.
    </Warning>
  </Accordion>

  <Accordion title="Claude Sonnet 3.7 tools">
    The following enhanced tools can be used with Claude Sonnet 3.7:

    * `{ "type": "computer_20250124", "name": "computer" }` - Includes new actions for more precise control
    * `{ "type": "text_editor_20250124", "name": "str_replace_editor" }` - Same capabilities as 20241022 version
    * `{ "type": "bash_20250124", "name": "bash" }` - Same capabilities as 20241022 version

    When using Claude Sonnet 3.7, you can also enable the extended thinking capability to understand the model's reasoning process.
  </Accordion>

  <Accordion title="Claude Sonnet 3.5 (new) tools">
    The following tools can be used with Claude Sonnet 3.5 (new):

    * `{ "type": "computer_20241022", "name": "computer" }`
    * `{ "type": "text_editor_20241022", "name": "str_replace_editor" }`
    * `{ "type": "bash_20241022", "name": "bash" }`
  </Accordion>
</AccordionGroup>

The `type` field identifies the tool and its parameters for validation purposes, the `name` field is the tool name exposed to the model.

If you want to prompt the model to use one of these tools, you can explicitly refer the tool by the `name` field. The `name` field must be unique within the tool list; you cannot define a tool with the same name as an Anthropic-defined tool in the same API call.

<Warning>
  We do not recommend defining tools with the names of Anthropic-defined tools.
  While you can still redefine tools with these names (as long as the tool name
  is unique in your `tools` block), doing so may result in degraded model
  performance.
</Warning>

<AccordionGroup>
  <Accordion title="Computer tool">
    <Warning>
      We do not recommend sending screenshots in resolutions above [XGA/WXGA](https://en.wikipedia.org/wiki/Display_resolution_standards#XGA) to avoid issues related to [image resizing](/en/docs/build-with-claude/vision#evaluate-image-size).
      Relying on the image resizing behavior in the API will result in lower model accuracy and slower performance than directly implementing scaling yourself.

      The [reference repository](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo/computer_use_demo/tools/computer.py) demonstrates how to scale from higher resolutions to a suggested resolution.
    </Warning>

    #### Types

    * `computer_20250124` - Enhanced computer tool with advanced features for Claude 4
    * `computer_20250124` - Enhanced computer tool with additional actions available in Claude Sonnet 3.7
    * `computer_20241022` - Original computer tool used with Claude Sonnet 3.5 (new)

    #### Parameters

    * `display_width_px`: **Required** The width of the display being controlled by the model in pixels.
    * `display_height_px`: **Required** The height of the display being controlled by the model in pixels.
    * `display_number`: **Optional** The display number to control (only relevant for X11 environments). If specified, the tool will be provided a display number in the tool definition.

    #### Tool description

    We are providing our tool description **for reference only**. You should not specify this in your Anthropic-defined tool call.

    ```plaintext
    Use a mouse and keyboard to interact with a computer, and take screenshots.
    * This is an interface to a desktop GUI. You do not have access to a terminal or applications menu. You must click on desktop icons to start applications.
    * Some applications may take time to start or process actions, so you may need to wait and take successive screenshots to see the results of your actions. E.g. if you click on Firefox and a window doesn't open, try taking another screenshot.
    * The screen's resolution is {{ display_width_px }}x{{ display_height_px }}.
    * The display number is {{ display_number }}
    * Whenever you intend to move the cursor to click on an element like an icon, you should consult a screenshot to determine the coordinates of the element before moving the cursor.
    * If you tried clicking on a program or link but it failed to load, even after waiting, try adjusting your cursor position so that the tip of the cursor visually falls on the element that you want to click.
    * Make sure to click any buttons, links, icons, etc with the cursor tip in the center of the element. Don't click boxes on their edges unless asked.
    ```

    #### Tool input schema

    We are providing our input schema **for reference only**. For the enhanced `computer_20250124` tool available with Claude Sonnet 3.7. Here is the full input schema:

    ```Python
    {
        "properties": {
            "action": {
                "description": "The action to perform. The available actions are:\n"
                "* `key`: Press a key or key-combination on the keyboard.\n"
                "  - This supports xdotool's `key` syntax.\n"
                '  - Examples: "a", "Return", "alt+Tab", "ctrl+s", "Up", "KP_0" (for the numpad 0 key).\n'
                "* `hold_key`: Hold down a key or multiple keys for a specified duration (in seconds). Supports the same syntax as `key`.\n"
                "* `type`: Type a string of text on the keyboard.\n"
                "* `cursor_position`: Get the current (x, y) pixel coordinate of the cursor on the screen.\n"
                "* `mouse_move`: Move the cursor to a specified (x, y) pixel coordinate on the screen.\n"
                "* `left_mouse_down`: Press the left mouse button.\n"
                "* `left_mouse_up`: Release the left mouse button.\n"
                "* `left_click`: Click the left mouse button at the specified (x, y) pixel coordinate on the screen. You can also include a key combination to hold down while clicking using the `text` parameter.\n"
                "* `left_click_drag`: Click and drag the cursor from `start_coordinate` to a specified (x, y) pixel coordinate on the screen.\n"
                "* `right_click`: Click the right mouse button at the specified (x, y) pixel coordinate on the screen.\n"
                "* `middle_click`: Click the middle mouse button at the specified (x, y) pixel coordinate on the screen.\n"
                "* `double_click`: Double-click the left mouse button at the specified (x, y) pixel coordinate on the screen.\n"
                "* `triple_click`: Triple-click the left mouse button at the specified (x, y) pixel coordinate on the screen.\n"
                "* `scroll`: Scroll the screen in a specified direction by a specified amount of clicks of the scroll wheel, at the specified (x, y) pixel coordinate. DO NOT use PageUp/PageDown to scroll.\n"
                "* `wait`: Wait for a specified duration (in seconds).\n"
                "* `screenshot`: Take a screenshot of the screen.",
                "enum": [
                    "key",
                    "hold_key",
                    "type",
                    "cursor_position",
                    "mouse_move",
                    "left_mouse_down",
                    "left_mouse_up",
                    "left_click",
                    "left_click_drag",
                    "right_click",
                    "middle_click",
                    "double_click",
                    "triple_click",
                    "scroll",
                    "wait",
                    "screenshot",
                ],
                "type": "string",
            },
            "coordinate": {
                "description": "(x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to move the mouse to. Required only by `action=mouse_move` and `action=left_click_drag`.",
                "type": "array",
            },
            "duration": {
                "description": "The duration to hold the key down for. Required only by `action=hold_key` and `action=wait`.",
                "type": "integer",
            },
            "scroll_amount": {
                "description": "The number of 'clicks' to scroll. Required only by `action=scroll`.",
                "type": "integer",
            },
            "scroll_direction": {
                "description": "The direction to scroll the screen. Required only by `action=scroll`.",
                "enum": ["up", "down", "left", "right"],
                "type": "string",
            },
            "start_coordinate": {
                "description": "(x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to start the drag from. Required only by `action=left_click_drag`.",
                "type": "array",
            },
            "text": {
                "description": "Required only by `action=type`, `action=key`, and `action=hold_key`. Can also be used by click or scroll actions to hold down keys while clicking or scrolling.",
                "type": "string",
            },
        },
        "required": ["action"],
        "type": "object",
    }
    ```

    For the original `computer_20241022` tool used with Claude Sonnet 3.5 (new):

    ```Python
    {
        "properties": {
            "action": {
                "description": """The action to perform. The available actions are:
                    * `key`: Press a key or key-combination on the keyboard.
                      - This supports xdotool's `key` syntax.
                      - Examples: "a", "Return", "alt+Tab", "ctrl+s", "Up", "KP_0" (for the numpad 0 key).
                    * `type`: Type a string of text on the keyboard.
                    * `cursor_position`: Get the current (x, y) pixel coordinate of the cursor on the screen.
                    * `mouse_move`: Move the cursor to a specified (x, y) pixel coordinate on the screen.
                    * `left_click`: Click the left mouse button.
                    * `left_click_drag`: Click and drag the cursor to a specified (x, y) pixel coordinate on the screen.
                    * `right_click`: Click the right mouse button.
                    * `middle_click`: Click the middle mouse button.
                    * `double_click`: Double-click the left mouse button.
                    * `screenshot`: Take a screenshot of the screen.""",
                "enum": [
                    "key",
                    "type",
                    "mouse_move",
                    "left_click",
                    "left_click_drag",
                    "right_click",
                    "middle_click",
                    "double_click",
                    "screenshot",
                    "cursor_position",
                ],
                "type": "string",
            },
            "coordinate": {
                "description": "(x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to move the mouse to. Required only by `action=mouse_move` and `action=left_click_drag`.",
                "type": "array",
            },
            "text": {
                "description": "Required only by `action=type` and `action=key`.",
                "type": "string",
            },
        },
        "required": ["action"],
        "type": "object",
    }
    ```
  </Accordion>

  <Accordion title="Text editor tool">
    #### Types

    * `text_editor_20250429` - Updated text editor for Claude 4 without the `undo_edit` command
    * `text_editor_20250124` - Same capabilities as the 20241022 version, for use with Claude Sonnet 3.7
    * `text_editor_20241022` - Original text editor tool used with Claude Sonnet 3.5 (new)

    #### Tool description

    We are providing our tool description **for reference only**. You should not specify this in your Anthropic-defined tool call.

    ```plaintext
    Custom editing tool for viewing, creating and editing files
    * State is persistent across command calls and discussions with the user
    * If `path` is a file, `view` displays the result of applying `cat -n`. If `path` is a directory, `view` lists non-hidden files and directories up to 2 levels deep
    * The `create` command cannot be used if the specified `path` already exists as a file
    * If a `command` generates a long output, it will be truncated and marked with `<response clipped>`
    * The `undo_edit` command will revert the last edit made to the file at `path` (not available in text_editor_20250429)

    Notes for using the `str_replace` command:
    * The `old_str` parameter should match EXACTLY one or more consecutive lines from the original file. Be mindful of whitespaces!
    * If the `old_str` parameter is not unique in the file, the replacement will not be performed. Make sure to include enough context in `old_str` to make it unique
    * The `new_str` parameter should contain the edited lines that should replace the `old_str`
    ```

    #### Tool input schema

    We are providing our input schema **for reference only**. You should not specify this in your Anthropic-defined tool call.

    ```JSON
    {
        "properties": {
            "command": {
                "description": "The commands to run. Allowed options are: `view`, `create`, `str_replace`, `insert`, `undo_edit`.",
                "enum": ["view", "create", "str_replace", "insert", "undo_edit"],
                "type": "string",
            },
            "file_text": {
                "description": "Required parameter of `create` command, with the content of the file to be created.",
                "type": "string",
            },
            "insert_line": {
                "description": "Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.",
                "type": "integer",
            },
            "new_str": {
                "description": "Optional parameter of `str_replace` command containing the new string (if not given, no string will be added). Required parameter of `insert` command containing the string to insert.",
                "type": "string",
            },
            "old_str": {
                "description": "Required parameter of `str_replace` command containing the string in `path` to replace.",
                "type": "string",
            },
            "path": {
                "description": "Absolute path to file or directory, e.g. `/repo/file.py` or `/repo`.",
                "type": "string",
            },
            "view_range": {
                "description": "Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.",
                "items": {"type": "integer"},
                "type": "array",
            },
        },
        "required": ["command", "path"],
        "type": "object",
    }
    ```
  </Accordion>

  <Accordion title="Bash tool">
    #### Types

    * `bash_20250124` - Enhanced bash tool for Claude 4 with improved capabilities
    * `bash_20250124` - Same capabilities as the 20241022 version, for use with Claude Sonnet 3.7
    * `bash_20241022` - Original bash tool used with Claude Sonnet 3.5 (new)

    #### Tool description

    We are providing our tool description **for reference only**. You should not specify this in your Anthropic-defined tool call.

    ```plaintext
    Run commands in a bash shell
    * When invoking this tool, the contents of the "command" parameter does NOT need to be XML-escaped.
    * You have access to a mirror of common linux and python packages via apt and pip.
    * State is persistent across command calls and discussions with the user.
    * To inspect a particular line range of a file, e.g. lines 10-25, try 'sed -n 10,25p /path/to/the/file'.
    * Please avoid commands that may produce a very large amount of output.
    * Please run long lived commands in the background, e.g. 'sleep 10 &' or start a server in the background.
    ```

    #### Tool input schema

    We are providing our input schema **for reference only**. You should not specify this in your Anthropic-defined tool call.

    ```JSON
    {
        "properties": {
            "command": {
                "description": "The bash command to run. Required unless the tool is being restarted.",
                "type": "string",
            },
            "restart": {
                "description": "Specifying true will restart this tool. Otherwise, leave this unspecified.",
                "type": "boolean",
            },
        }
    }
    ```
  </Accordion>
</AccordionGroup>

### Enable thinking capability in Claude 4 and Claude Sonnet 3.7

Claude Sonnet 3.7 introduced a new "thinking" capability that allows you to see the model's reasoning process as it works through complex tasks. This feature helps you understand how Claude is approaching a problem and can be particularly valuable for debugging or educational purposes.

To enable thinking, add a `thinking` parameter to your API request:

```json
"thinking": {
  "type": "enabled",
  "budget_tokens": 1024
}
```

The `budget_tokens` parameter specifies how many tokens Claude can use for thinking. This is subtracted from your overall `max_tokens` budget.

When thinking is enabled, Claude will return its reasoning process as part of the response, which can help you:

1. Understand the model's decision-making process
2. Identify potential issues or misconceptions
3. Learn from Claude's approach to problem-solving
4. Get more visibility into complex multi-step operations

Here's an example of what thinking output might look like:

```
[Thinking]
I need to save a picture of a cat to the desktop. Let me break this down into steps:

1. First, I'll take a screenshot to see what's on the desktop
2. Then I'll look for a web browser to search for cat images
3. After finding a suitable image, I'll need to save it to the desktop

Let me start by taking a screenshot to see what's available...
```

### Combine computer use with other tools

You can combine [regular tool use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use#single-tool-example) with the Anthropic-defined tools for computer use.

<CodeGroup>
  ```bash Shell
  curl https://api.anthropic.com/v1/messages \
    -H "content-type: application/json" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: computer-use-2025-01-24" \
    -d '{
      "model": "claude-4-opus-20250514",
      "max_tokens": 2000,
      "tools": [
        {
          "type": "computer_20250124",
          "name": "computer",
          "display_width_px": 1024,
          "display_height_px": 768,
          "display_number": 1
        },
        {
          "type": "text_editor_20250124",
          "name": "str_replace_editor"
        },
        {
          "type": "bash_20250124",
          "name": "bash"
        },
        {
          "name": "get_weather",
          "description": "Get the current weather in a given location",
          "input_schema": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "The city and state, e.g. San Francisco, CA"
              },
              "unit": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "The unit of temperature, either 'celsius' or 'fahrenheit'"
              }
            },
            "required": ["location"]
          }
        }
      ],
      "messages": [
        {
          "role": "user",
          "content": "Find flights from San Francisco to a place with warmer weather."
        }
      ],
      "thinking": {
        "type": "enabled",
        "budget_tokens": 1024
      }
    }'
  ```

  ```Python Python
  import anthropic

  client = anthropic.Anthropic()

  response = client.beta.messages.create(
      model="claude-3-7-sonnet-20250219",
      max_tokens=1024,
      tools=[
          {
            "type": "computer_20250124",
            "name": "computer",
            "display_width_px": 1024,
            "display_height_px": 768,
            "display_number": 1,
          },
          {
            "type": "text_editor_20250124",
            "name": "str_replace_editor"
          },
          {
            "type": "bash_20250124",
            "name": "bash"
          },
          {
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "input_schema": {
              "type": "object",
              "properties": {
                "location": {
                  "type": "string",
                  "description": "The city and state, e.g. San Francisco, CA"
                },
                "unit": {
                  "type": "string",
                  "enum": ["celsius", "fahrenheit"],
                  "description": "The unit of temperature, either 'celsius' or 'fahrenheit'"
                }
              },
              "required": ["location"]
            }
          },
      ],
      messages=[{"role": "user", "content": "Find flights from San Francisco to a place with warmer weather."}],
      betas=["computer-use-2025-01-24"],
      thinking={"type": "enabled", "budget_tokens": 1024},
  )
  print(response)
  ```

  ```TypeScript TypeScript
  import Anthropic from '@anthropic-ai/sdk';

  const anthropic = new Anthropic();

  const message = await anthropic.beta.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 1024,
    tools: [
        {
          type: "computer_20250124",
          name: "computer",
          display_width_px: 1024,
          display_height_px: 768,
          display_number: 1,
        },
        {
          type: "text_editor_20250124",
          name: "str_replace_editor"
        },
        {
          type: "bash_20250124",
          name: "bash"
        },
        {
          name: "get_weather",
          description: "Get the current weather in a given location",
          input_schema: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA"
              },
              unit: {
                type: "string",
                enum: ["celsius", "fahrenheit"],
                description: "The unit of temperature, either 'celsius' or 'fahrenheit'"
              }
            },
            required: ["location"]
          }
        },
    ],
    messages: [{ role: "user", content: "Find flights from San Francisco to a place with warmer weather." }],
    betas: ["computer-use-2025-01-24"],
    thinking: { type: "enabled", budget_tokens": 1024 },
  });
  console.log(message);
  ```

  ```java Java
  import java.util.List;
  import java.util.Map;

  import com.anthropic.client.AnthropicClient;
  import com.anthropic.client.okhttp.AnthropicOkHttpClient;
  import com.anthropic.core.JsonValue;
  import com.anthropic.models.beta.messages.BetaMessage;
  import com.anthropic.models.beta.messages.MessageCreateParams;
  import com.anthropic.models.beta.messages.BetaToolBash20250124;
  import com.anthropic.models.beta.messages.BetaToolComputerUse20250124;
  import com.anthropic.models.beta.messages.BetaToolTextEditor20250124;
  import com.anthropic.models.beta.messages.BetaThinkingConfigEnabled;
  import com.anthropic.models.beta.messages.BetaThinkingConfigParam;
  import com.anthropic.models.beta.messages.BetaTool;

  public class MultipleToolsExample {

      public static void main(String[] args) {
          AnthropicClient client = AnthropicOkHttpClient.fromEnv();

          MessageCreateParams params = MessageCreateParams.builder()
                  .model("claude-3-7-sonnet-20250219")
                  .maxTokens(1024)
                  .addTool(BetaToolComputerUse20250124.builder()
                          .displayWidthPx(1024)
                          .displayHeightPx(768)
                          .displayNumber(1)
                          .build())
                  .addTool(BetaToolTextEditor20250124.builder()
                          .build())
                  .addTool(BetaToolBash20250124.builder()
                          .build())
                  .addTool(BetaTool.builder()
                          .name("get_weather")
                          .description("Get the current weather in a given location")
                          .inputSchema(BetaTool.InputSchema.builder()
                                  .properties(
                                          JsonValue.from(
                                                  Map.of(
                                                          "location", Map.of(
                                                                  "type", "string",
                                                                  "description", "The city and state, e.g. San Francisco, CA"
                                                          ),
                                                          "unit", Map.of(
                                                                  "type", "string",
                                                                  "enum", List.of("celsius", "fahrenheit"),
                                                                  "description", "The unit of temperature, either 'celsius' or 'fahrenheit'"
                                                          )
                                                  )
                                          ))
                                  .build()
                          )
                          .build())
                  .thinking(BetaThinkingConfigParam.ofEnabled(
                          BetaThinkingConfigEnabled.builder()
                                  .budgetTokens(1024)
                                  .build()
                  ))
                  .addUserMessage("Find flights from San Francisco to a place with warmer weather.")
                  .addBeta("computer-use-2025-01-24")
                  .build();

          BetaMessage message = client.beta().messages().create(params);
          System.out.println(message);
      }
  }
  ```
</CodeGroup>

### Build a custom computer use environment

The [reference implementation](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo) is meant to help you get started with computer use. It includes all of the components needed have Claude use a computer. However, you can build your own environment for computer use to suit your needs. You'll need:

* A virtualized or containerized environment suitable for computer use with Claude
* An implementation of at least one of the Anthropic-defined computer use tools
* An agent loop that interacts with the Anthropic API and executes the `tool_use` results using your tool implementations
* An API or UI that allows user input to start the agent loop

***

## Understand computer use limitations

The computer use functionality is in beta. While Claude’s capabilities are cutting edge, developers should be aware of its limitations:

1. **Latency**: the current computer use latency for human-AI interactions may be too slow compared to regular human-directed computer actions. We recommend focusing on use cases where speed isn’t critical (e.g., background information gathering, automated software testing) in trusted environments.
2. **Computer vision accuracy and reliability**: Claude may make mistakes or hallucinate when outputting specific coordinates while generating actions. Claude Sonnet 3.7 introduces the thinking capability that can help you understand the model's reasoning and identify potential issues.
3. **Tool selection accuracy and reliability**: Claude may make mistakes or hallucinate when selecting tools while generating actions or take unexpected actions to solve problems. Additionally, reliability may be lower when interacting with niche applications or multiple applications at once. We recommend that users prompt the model carefully when requesting complex tasks.
4. **Scrolling reliability**: While Claude Sonnet 3.5 (new) had limitations with scrolling, Claude Sonnet 3.7 introduces dedicated scroll actions with direction control that improves reliability. The model can now explicitly scroll in any direction (up/down/left/right) by a specified amount.
5. **Spreadsheet interaction**: Mouse clicks for spreadsheet interaction have improved in Claude Sonnet 3.7 with the addition of more precise mouse control actions like `left_mouse_down`, `left_mouse_up`, and new modifier key support. Cell selection can be more reliable by using these fine-grained controls and combining modifier keys with clicks.
6. **Account creation and content generation on social and communications platforms**: While Claude will visit websites, we are limiting its ability to create accounts or generate and share content or otherwise engage in human impersonation across social media websites and platforms. We may update this capability in the future.
7. **Vulnerabilities**: Vulnerabilities like jailbreaking or prompt injection may persist across frontier AI systems, including the beta computer use API. In some circumstances, Claude will follow commands found in content, sometimes even in conflict with the user's instructions. For example, Claude instructions on webpages or contained in images may override instructions or cause Claude to make mistakes. We recommend:
   a. Limiting computer use to trusted environments such as virtual machines or containers with minimal privileges
   b. Avoiding giving computer use access to sensitive accounts or data without strict oversight
   c. Informing end users of relevant risks and obtaining their consent before enabling or requesting permissions necessary for computer use features in your applications
8. **Inappropriate or illegal actions**: Per Anthropic’s terms of service, you must not employ computer use to violate any laws or our Acceptable Use Policy.

Always carefully review and verify Claude’s computer use actions and logs. Do not use Claude for tasks requiring perfect precision or sensitive user information without human oversight.

***

## Pricing

<Info>
  See the [tool use pricing](/en/docs/build-with-claude/tool-use#pricing)
  documentation for a detailed explanation of how Claude Tool Use API requests
  are priced.
</Info>

As a subset of tool use requests, computer use requests are priced the same as any other Claude API request.

We also automatically include a special system prompt for the model, which enables computer use.

| Model                   | Tool choice                                | System prompt token count                   |
| ----------------------- | ------------------------------------------ | ------------------------------------------- |
| Claude 4 Opus & Sonnet  | `auto`<hr className="my-2" />`any`, `tool` | 466 tokens<hr className="my-2" />499 tokens |
| Claude Sonnet 3.7       | `auto`<hr className="my-2" />`any`, `tool` | 466 tokens<hr className="my-2" />499 tokens |
| Claude Sonnet 3.5 (new) | `auto`<hr className="my-2" />`any`, `tool` | 466 tokens<hr className="my-2" />499 tokens |

In addition to the base tokens, the following additional input tokens are needed for the Anthropic-defined tools:

| Tool                                              | Additional input tokens |
| ------------------------------------------------- | ----------------------- |
| `computer_20250124` (Claude 4, Claude Sonnet 3.7) | 735 tokens              |
| `computer_20241022` (Claude Sonnet 3.5)           | 683 tokens              |
| `text_editor_20250429` (Claude 4)                 | 700 tokens              |
| `text_editor_20250124` (Claude Sonnet 3.7)        | 700 tokens              |
| `text_editor_20241022` (Claude Sonnet 3.5)        | 700 tokens              |
| `bash_20250124` (Claude Sonnet 3.7, Claude 4)     | 245 tokens              |
| `bash_20241022` (Claude Sonnet 3.5)               | 245 tokens              |

If you enable thinking with Claude 4 or Claude Sonnet 3.7, the tokens used for thinking will be counted against your `max_tokens` budget based on the `budget_tokens` you specify in the thinking parameter.