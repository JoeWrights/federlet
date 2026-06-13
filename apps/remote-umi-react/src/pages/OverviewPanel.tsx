import React, { useState } from "react";
import { Button, Modal } from "antd";
import { useRemoteAppContext } from "../RemoteAppContext";

const UmiAntdButton = Button as unknown as React.ComponentType<{
  children?: React.ReactNode;
  onClick?: () => void;
  type?: "primary";
}>;

const UmiAntdModal = Modal as unknown as React.ComponentType<{
  children?: React.ReactNode;
  footer?: null;
  getContainer?: () => HTMLElement;
  onCancel?: () => void;
  open: boolean;
  title: string;
}>;

export default function OverviewPanel() {
  const { portalContainer } = useRemoteAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section className="umi-remote__panel">
      <strong>128</strong>
      <span>orders processed by the legacy Umi business module</span>
      <UmiAntdButton type="primary" onClick={() => setIsModalOpen(true)}>
        Open Umi AntD modal
      </UmiAntdButton>
      <UmiAntdModal
        open={isModalOpen}
        title="Umi-scoped Ant Design modal"
        footer={null}
        onCancel={() => setIsModalOpen(false)}
        getContainer={() => portalContainer ?? document.body}
      >
        This modal is rendered by Ant Design 5 inside the Umi React remote.
      </UmiAntdModal>
    </section>
  );
}
