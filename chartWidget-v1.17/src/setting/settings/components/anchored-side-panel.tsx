import { React } from "jimu-core";
import { SidePopper } from "jimu-ui/advanced/setting-components";
import { Navigation } from "./navigation";

interface AnchoredSidePanelProps {
  level?: 1 | 2 | 3;
  label: string;
  title: string;
  buttonStickRight?: boolean;
  children: React.ReactElement;
}

export const AnchoredSidePanel = (
  props: AnchoredSidePanelProps,
): React.ReactElement => {
  const { level, label, title, buttonStickRight = false, children } = props;

  const [active, setActive] = React.useState<boolean>(false);
  const [triggerElement, setTriggerElement] = React.useState<HTMLElement>(null);

  return (
    <>
      <Navigation
        className="mt-2"
        level={level}
        active={active}
        title={label}
        stickRight={buttonStickRight}
        onClick={(e) => {
          setTriggerElement(e.currentTarget as HTMLElement);
          setActive(!active);
        }}
      />
      <SidePopper
        title={title}
        isOpen={active}
        position="right"
        toggle={() => {
          setActive(false);
        }}
        trigger={triggerElement}
        backToFocusNode={triggerElement}
      >
        {children}
      </SidePopper>
    </>
  );
};
