/**@jsx jsx */
import { React, jsx, css, classNames, type ImmutableObject, Immutable, hooks } from 'jimu-core'
import { Button, defaultMessages } from 'jimu-ui'
import { MinusCircleOutlined } from 'jimu-icons/outlined/editor/minus-circle'
import type { WebChartPieChartSlice } from 'jimu-ui/advanced/chart'
import { EditableText } from '../../../../components'

interface ColorItemProps {
  className?: string
  editable?: boolean
  value: ImmutableObject<WebChartPieChartSlice>
  onChange?: (value: ImmutableObject<WebChartPieChartSlice>) => void
  deletable?: boolean
  onDelete?: (sliceId: string) => void
}

// Simple HTML color picker compatible with ExB 1.17
const SimpleColorPicker: React.FC<{
  value: string;
  onChange: (color: string) => void;
  ariaLabel?: string;
}> = ({ value, onChange, ariaLabel }) => {
  const colorInputStyle = css`
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid #BDBDBD;
    border-radius: 4px;
    cursor: pointer;
    background: transparent;
    
    &::-webkit-color-swatch-wrapper {
      padding: 2px;
    }
    &::-webkit-color-swatch {
      border: none;
      border-radius: 2px;
    }
  `;

  return (
    <input
      type="color"
      css={colorInputStyle}
      value={value && value.startsWith('#') ? value : '#5E8FD0'}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    />
  );
};

const style = css`
  display: flex;
  width: 100%;
  justify-content: space-between;
  .editor-text-color {
    width: 88%;
    flex-grow: 1;
    display: inline-flex;
    justify-content: space-between;
    .label {
      max-width: 70%;
    }
  }
`
const defaultValue = Immutable({}) as ImmutableObject<WebChartPieChartSlice>
export const ColorItem = (props: ColorItemProps): React.ReactElement => {
  const { className, editable = true, value: propValue = defaultValue, onChange, deletable, onDelete } = props
  const label = propValue.label ?? propValue.sliceId
  const color = propValue.fillSymbol?.color as any

  console.log('ColorItem render:', label, color)

  const translate = hooks.useTranslation(defaultMessages)

  const handleColorChange = (color: string) => {
    console.log('ColorItem handleColorChange input:', color)
    let currentSlice = propValue as any
    if (currentSlice.asMutable) {
      currentSlice = currentSlice.asMutable({ deep: true })
    } else {
      currentSlice = { ...currentSlice }
    }

    if (!currentSlice.fillSymbol) {
      currentSlice.fillSymbol = {}
    } else {
      currentSlice.fillSymbol = { ...currentSlice.fillSymbol }
    }

    currentSlice.fillSymbol.color = color

    const value = Immutable(currentSlice)
    console.log('ColorItem handleColorChange output:', value)
    onChange?.(value)
  }

  const handleLabelChange = (label: string) => {
    const value = Immutable(propValue).set('label', label)
    onChange?.(value)
  }

  const handleDeleteClick = () => {
    onDelete?.(propValue.sliceId)
  }

  return (
    <div css={style} className={classNames('color-item', className)}>
      <div className='editor-text-color'>
        <EditableText className='label text-truncate' editable={editable} value={label} onChange={handleLabelChange}></EditableText>
        <SimpleColorPicker ariaLabel={label} value={color} onChange={handleColorChange} />
      </div>
      {
        deletable && <Button aria-label={translate('remove')} title={translate('remove')} type='tertiary' icon size='sm' onClick={handleDeleteClick}><MinusCircleOutlined size='m' /></Button>
      }
    </div>
  )
}
