import { type IMThemeVariables, css, polished } from 'jimu-core'
export const getStyle = (theme: IMThemeVariables, reference) => {
  return css`
    & {
      max-height: ${polished.rem(300)};
      width: ${polished.rem(reference?.current?.clientWidth)};
      overflow: auto;
      padding-top: 0;
      padding-bottom: 0;
      visibility: unset !important;
    }
    &.result-list-con .dropdown-item {
      text-overflow: ellipsis;
      white-space: pre-wrap;
    }
    &.result-list-con .dropdown-item:disabled {
      color: ${theme?.sys.color?.secondary?.dark};
      background-color: ${theme?.ref.palette?.neutral?.[300]};
      /* color: ${theme?.ref.palette?.black};
      background-color: ${theme?.ref.palette?.neutral?.[200]}; */
    }
    &.result-list-con .dropdown-item:hover, &.result-list-con .dropdown-item:focus {
      color: ${theme?.ref.palette?.black};
      background-color: ${theme?.ref.palette?.neutral?.[200]};
    }
    &.result-list-con .jimu-dropdown-item-divider {
      margin-left: 0;
      margin-right: 0;
    }
    &.result-list-con .dropdown-item.active {
      background: ${theme?.sys.color?.primary.main};
      color: ${theme?.ref.palette?.white};
    }
    .show-result-button:active, &.result-list-con .show-result-button:focus {
      background-color: ${theme?.ref.palette?.white};
    }
    .dropdown-menu--inner {
      max-height: none;
    }
  `
}
