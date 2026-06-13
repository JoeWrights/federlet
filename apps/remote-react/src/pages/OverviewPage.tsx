import { useState } from "react";
import { Alert, Modal as AntdModal } from "antd";
import {
  MetricTile,
  SharedButton,
  SharedCard,
} from "@federlet/shared-ui";
import { useRemoteAppContext } from "../RemoteAppContext";

export default function OverviewPage() {
  const { portalContainer } = useRemoteAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section className="react-remote__shared-grid">
      <SharedCard eyebrow="React remote" title="Shared UI card">
        This card is imported from @federlet/shared-ui and resolved through the
        Module Federation shared scope.
      </SharedCard>

      <MetricTile value="1x" label="shared-ui runtime loaded by the Shell" />

      <SharedButton onClick={() => setIsModalOpen(true)}>
        Open shared dashboard
      </SharedButton>

      <Alert
        message="Ant Design 5 is provided by the Shell"
        description="remote-react consumes antd from the Rspack Module Federation shared scope."
        type="success"
        showIcon
      />

      <AntdModal
        open={isModalOpen}
        title="Shell-scoped Ant Design modal"
        footer={null}
        onCancel={() => setIsModalOpen(false)}
        getContainer={() => portalContainer ?? document.body}
      >
        This modal is rendered by Ant Design, but its portal is scoped to the
        Shell remote mount container.
      </AntdModal>
    </section>
  );
}
