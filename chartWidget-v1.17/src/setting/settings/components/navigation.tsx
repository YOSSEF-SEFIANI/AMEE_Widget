import { React, classNames } from "jimu-core";
import { Button } from "jimu-ui";

export interface NavigationProps {
  level?: 1 | 2 | 3;
  title: string;
  active?: boolean;
  stickRight?: boolean;
  onClick: () => void;
  className?: string;
}

const getLevelClass = (level: number) => {
  switch (level) {
    case 1:
      return "text-level-1";
    case 2:
      return "text-level-2";
    case 3:
    default:
      return "text-level-3";
  }
};

export const Navigation = (props: NavigationProps): React.ReactElement => {
  const {
    level = 3,
    title,
    active,
    onClick,
    className,
    stickRight = false,
  } = props;

  return (
    <div
      className={classNames(
        className,
        "navigation w-100 d-flex align-items-center justify-content-between",
        getLevelClass(level),
      )}
    >
      <span className="title">{title}</span>
      <Button
        className={classNames({ "pr-0": stickRight })}
        aria-label={title}
        size="sm"
        type="tertiary"
        active={active}
        onClick={onClick}
      >
        ⚙
      </Button>
    </div>
  );
};
