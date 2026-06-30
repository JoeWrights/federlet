import { describe, expect, it, vi } from "vitest";
import {
  getRemoteComponent,
  listRemoteComponents,
  loadRemoteComponent,
} from "./remote-components";
import { createRuntimeRemoteRegistry } from "./remote-registry";

describe("remote component discovery", () => {
  it("lists and finds components declared by registered remotes", () => {
    const registry = createRuntimeRemoteRegistry(() => 1000);
    registry.registerMany([
      {
        basename: "/react",
        components: [
          {
            contractVersion: "^1.0.0",
            expose: "./components/PrimaryButton",
            framework: "react",
            name: "PrimaryButton",
            typePackage: "@federlet/remote-react-contracts",
          },
        ],
        exposedModule: "./mount",
        id: "react-dashboard",
        path: "/react/*",
        remoteName: "remote_react",
        title: "React Remote",
      },
    ]);

    expect(listRemoteComponents({ registry })).toEqual([
      {
        contractVersion: "^1.0.0",
        expose: "./components/PrimaryButton",
        framework: "react",
        moduleName: "remote_react/components/PrimaryButton",
        name: "PrimaryButton",
        remoteName: "remote_react",
        typePackage: "@federlet/remote-react-contracts",
      },
    ]);
    expect(getRemoteComponent("remote_react", "PrimaryButton", { registry }))
      .toMatchObject({
        moduleName: "remote_react/components/PrimaryButton",
        name: "PrimaryButton",
      });
  });

  it("loads a declared component through its federated module name", async () => {
    const registry = createRuntimeRemoteRegistry(() => 1000);
    const remoteModule = {
      default: function PrimaryButton() {
        return null;
      },
    };
    const loader = vi.fn(async () => remoteModule);

    registry.registerMany([
      {
        basename: "/react",
        components: [
          {
            expose: "./components/PrimaryButton",
            framework: "react",
            name: "PrimaryButton",
            typePackage: "@federlet/remote-react-contracts",
          },
        ],
        exposedModule: "./mount",
        id: "react-dashboard",
        path: "/react/*",
        remoteName: "remote_react",
        title: "React Remote",
      },
    ]);

    await expect(
      loadRemoteComponent("remote_react", "PrimaryButton", loader, { registry }),
    ).resolves.toBe(remoteModule);
    expect(loader).toHaveBeenCalledWith("remote_react/components/PrimaryButton");
  });

  it("rejects loading components that are not declared in the registry", async () => {
    const registry = createRuntimeRemoteRegistry(() => 1000);
    const loader = vi.fn();

    await expect(
      loadRemoteComponent("remote_react", "MissingButton", loader, { registry }),
    ).rejects.toThrow(
      "Remote component remote_react/MissingButton is not registered.",
    );
    expect(loader).not.toHaveBeenCalled();
  });
});
