/** @jsx jsx */
import { React, jsx, css, polished, hooks, Immutable } from 'jimu-core'
import { Switch, defaultMessages as jimuUiDefaultMessage } from 'jimu-ui'
import { SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { SizeColorSetting } from 'jimu-ui/advanced/style-setting-components'
import { ThemeColorPicker } from 'jimu-ui/basic/color-picker'
import { getTheme2 } from 'jimu-theme'
import { type IMConfig, DEFAULT_OUTLINE, PREVIEW_BACKGROUND } from '../../config'
import { checkIsOutlineSizeAvailable } from '../util/util'
import defaultMessage from '../translations/default'
interface Props {
  config: IMConfig
  handlePropertyChange: (key: string, value) => void
}
const PreviewStyle = (props: Props) => {
  const theme2 = getTheme2()
  const nls = hooks.useTranslation(defaultMessage, jimuUiDefaultMessage)
  const { config, handlePropertyChange } = props
  const STYLE = css`
    .outline-con {
      input {
        width: ${polished.rem(55)};
      }
    }
    .preview-style-setting-con {
      margin-top: ${polished.rem(16)};
    }
    .enable-preview-label {
      margin-right: ${polished.rem(10)};
    }
  `
  const handleEnablePreviewChange = () => {
    handlePropertyChange('enablePreview', !config?.enablePreview)
  }

  const handlePreviewBackgroundChange = (value: string) => {
    if (value.length === 0) {
      value = PREVIEW_BACKGROUND
    }
    handlePropertyChange('previewBackgroundColor', value)
  }

  const handlePreviewOutLineChange = (key: string, value: string) => {
    const isOutlineSize = value?.includes('px')
    const available = checkIsOutlineSizeAvailable(value)
    if (isOutlineSize && !available) return
    const previewOutLine = config?.previewOutLine || Immutable(DEFAULT_OUTLINE)
    if (value.length === 0) {
      value = DEFAULT_OUTLINE[key]
    }
    handlePropertyChange('previewOutLine', previewOutLine.setIn([key], value))
  }

  const renderPreviewStyleSetting = () => {
    return (
      <div className='preview-style-setting-con'>
        <SettingRow label={nls('fill')} aria-label={nls('fill')}>
          <ThemeColorPicker
            value={config?.previewBackgroundColor}
            specificTheme={theme2}
            onChange={handlePreviewBackgroundChange}
          />
        </SettingRow>

        <SettingRow className='outline-con' flow='no-wrap' label={nls('columnOutline')} aria-label={nls('columnOutline')}>
          <SizeColorSetting
            color={config?.previewOutLine?.color || DEFAULT_OUTLINE.color}
            size={config?.previewOutLine?.size as string || DEFAULT_OUTLINE.size}
            onChange={handlePreviewOutLineChange}
          />
        </SettingRow>
      </div>
    )
  }

  const getLabel = () => {
    return (
      <div className='d-flex align-items-center' onClick={handleEnablePreviewChange}>
        <div className='flex-grow-1 enable-preview-label text-truncate w-100' title={nls('showPrintArea')}>{nls('showPrintArea')}</div>
        <Switch
          aria-label={nls('showPrintArea')}
          checked={config?.enablePreview}
          onChange={handleEnablePreviewChange}
          title={nls('showPrintArea')}
        />
      </div>
    )
  }

  return (
    <SettingSection css={STYLE} role='group' title={getLabel()} aria-label={nls('showPrintArea')}>
      {config?.enablePreview && renderPreviewStyleSetting()}
    </SettingSection>
  )
}

export default PreviewStyle
