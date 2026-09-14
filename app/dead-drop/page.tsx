import { DeadDropWorkspace } from "@/components/DeadDropWorkspace";
import { Providers } from "../providers";

export const metadata = { title: "Create a private message link | HexOnion" };

export default function DeadDropPage() {
  return <Providers><DeadDropWorkspace /></Providers>;
}
