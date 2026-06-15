/**
 * Central provider registry initializer.
 * Import this module once at app boot (app layout) to register all built-in providers.
 *
 * To add a new input provider:
 *   1. Create components: MyListPage, MyCreatePage, MyEditPage
 *   2. Call registerInput({ type: 'my-type', label: '...', icon: ..., ..., ListPage, CreatePage, EditPage })
 *   3. Optionally call registerModuleSettingsNav({ module: 'my-type', labelKey: '...', icon: ... })
 *
 * To add a new output provider:
 *   1. Call registerOutput({ type: 'my-type', label: '...', icon: ..., description: '...' })
 *   2. Optionally call registerModuleSettingsNav({ module: 'my-type', labelKey: '...', icon: ... })
 */
import { Globe, Mail, Server } from "lucide-react";
import { registerInput } from "./input-registry";
import { registerOutput } from "./output-registry";
import { registerModuleSettingsNav } from "./module-settings-registry";
import { HttpRestListPage } from "@/components/input/http-rest/HttpRestListPage";
import { HttpRestCreatePage } from "@/components/input/http-rest/HttpRestCreatePage";
import { HttpRestEditPage } from "@/components/input/http-rest/HttpRestEditPage";
import { SshInputListPage } from "@/components/input/ssh/SshInputListPage";
import { SshInputCreatePage } from "@/components/input/ssh/SshInputCreatePage";
import { SshInputEditPage } from "@/components/input/ssh/SshInputEditPage";

registerInput({
  type: "http-rest",
  label: "input.type.httpRest",
  icon: Globe,
  description: "input.typeDesc.httpRest",
  ListPage: HttpRestListPage,
  CreatePage: HttpRestCreatePage,
  EditPage: HttpRestEditPage,
});

registerInput({
  type: "ssh",
  label: "input.type.ssh",
  icon: Server,
  description: "input.typeDesc.ssh",
  ListPage: SshInputListPage,
  CreatePage: SshInputCreatePage,
  EditPage: SshInputEditPage,
});

registerOutput({
  type: "mail",
  label: "Email",
  icon: Mail,
  description: "Send the backup archive as an email attachment via SMTP.",
});

registerModuleSettingsNav({ module: "http-rest", labelKey: "input.type.httpRest", icon: Globe });
registerModuleSettingsNav({ module: "mail", labelKey: "output.type.mail", icon: Mail });
