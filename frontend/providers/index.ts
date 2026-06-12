/**
 * Central provider registry initializer.
 * Import this module once at app boot (app layout) to register all built-in providers.
 *
 * To add a new input provider:
 *   1. Create components: MyListPage, MyCreatePage, MyEditPage
 *   2. Call registerInput({ type: 'my-type', label: '...', icon: ..., ..., ListPage, CreatePage, EditPage })
 *
 * To add a new output provider:
 *   1. Call registerOutput({ type: 'my-type', label: '...', icon: ..., description: '...' })
 */
import { Globe, Mail } from "lucide-react";
import { registerInput } from "./input-registry";
import { registerOutput } from "./output-registry";
import { HttpRestListPage } from "@/components/input/http-rest/HttpRestListPage";
import { HttpRestCreatePage } from "@/components/input/http-rest/HttpRestCreatePage";
import { HttpRestEditPage } from "@/components/input/http-rest/HttpRestEditPage";

registerInput({
  type: "http-rest",
  label: "input.type.httpRest",
  icon: Globe,
  description: "input.typeDesc.httpRest",
  ListPage: HttpRestListPage,
  CreatePage: HttpRestCreatePage,
  EditPage: HttpRestEditPage,
});

registerOutput({
  type: "mail",
  label: "Email",
  icon: Mail,
  description: "Send the backup archive as an email attachment via SMTP.",
});
