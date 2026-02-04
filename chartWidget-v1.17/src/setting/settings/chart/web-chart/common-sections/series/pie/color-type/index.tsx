/** @jsx jsx */
import { React, classNames, type ImmutableObject, type ImmutableArray, Immutable, hooks, jsx, css } from 'jimu-core'
import { SettingOutlined } from 'jimu-icons/outlined/application/setting'
import { Button, Label, Radio } from 'jimu-ui'
import defaultMessages from '../../../../../../../translations/default'
import type { ISimpleFillSymbol, WebChartPieChartSeries, WebChartPieChartSlice } from 'jimu-ui/advanced/chart'
import { CategoryType, type ChartDataSource, type WebChartSeries } from '../../../../../../../../config'
import { DefaultColorBySlicesOtherColor } from '../../../../../../../../utils/default'
import { getByFieldPieSlices, type LoadSlices } from '../utils'
import { ColorList } from './color-list'
import { MaxColorCount } from '../../../../../../../../constants'
import { getCategoryType } from '../../../../../../../../utils/common'
import { COLORS_SET } from '../../components'

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

interface ColorTypeProps {
  className?: string
  loading?: boolean
  colors: string[]
  loadSlices?: LoadSlices
  defaultFillSymbol?: Immutable.ImmutableObject<ISimpleFillSymbol>
  series: ImmutableArray<WebChartSeries>
  chartDataSource: ImmutableObject<ChartDataSource>
  onChange?: (series: ImmutableArray<WebChartSeries>) => void
  onColorsChange?: (colors: string[]) => void
}

export const ColorType = (props: ColorTypeProps): React.ReactElement => {
  const {
    className,
    colors,
    loading,
    chartDataSource,
    defaultFillSymbol,
    series: propSeries,
    onChange,
    loadSlices,
    onColorsChange
  } = props
  const unmountRef = React.useRef<boolean>(false)
  hooks.useUnmount(() => { unmountRef.current = true })
  const translate = hooks.useTranslation(defaultMessages)

  const colorMatchBtnRef = React.useRef<HTMLButtonElement>(null)
  const [open, setOpen] = React.useState(false)
  const propSerie = propSeries?.[0] as ImmutableObject<WebChartPieChartSeries>
  const propSlices = propSerie?.slices
  const query = chartDataSource?.query
  const categoryType = getCategoryType(query)

  const numericFields = query?.outStatistics
    ?.map((outStatistic) => outStatistic.onStatisticField)
    .filter((field) => !!field)

  const colorMode = propSerie?.slices?.length ? 'bySlices' : 'singleColor'
  const fillSymbol = propSerie?.fillSymbol
  const outline = fillSymbol?.outline
  const singleColor = fillSymbol?.color as any

  // ✅ Auto-reload slices si en mode bySlices mais slices invalides
  React.useEffect(() => {
    if (colorMode === 'bySlices' && categoryType === CategoryType.ByGroup && loadSlices) {
      const hasValidSlices = propSlices && propSlices.length > 0 && 
                             propSlices.some(slice => slice.label && slice.label !== 'null' && slice.label.trim() !== '')
      
      if (!hasValidSlices) {
        loadSlices(MaxColorCount, outline).then(({ value: slices }) => {
          if (unmountRef.current) return
          if (slices && slices.length > 0) {
            const series = Immutable.setIn(propSeries, ['0', 'slices'], slices)
            onChange?.(series)
          }
        }).catch((error) => {
          console.error('❌ [ColorType] Failed to auto-reload slices:', error)
        })
      }
    }
  }, []) // Exécuter une seule fois au montage

  const handleSingleColorChange = (value: string) => {
    value = value || defaultFillSymbol.color as any
    const series = Immutable.setIn(
      propSeries,
      ['0', 'fillSymbol', 'color'],
      value
    )
    onChange?.(series)
  }

  const handleColorTypeChange = (type: 'singleColor' | 'bySlices') => {
    let series = propSeries
    if (type === 'singleColor') {
      series = Immutable.setIn(
        series,
        ['0', 'fillSymbol'],
        fillSymbol.set('color', defaultFillSymbol.color as any)
      )
      series = series.map(serie => (serie as ImmutableObject<WebChartPieChartSeries>).without('slices') as any)
      onChange?.(series)
    } else if (type === 'bySlices') {
      if (categoryType === CategoryType.ByGroup) {
        series = Immutable.setIn(
          series,
          ['0', 'fillSymbol'],
          fillSymbol.set('color', DefaultColorBySlicesOtherColor)
        )
        loadSlices(MaxColorCount, outline).then(({ value: slices }) => {
          if (unmountRef.current) return
          series = Immutable.setIn(series, ['0', 'slices'], slices)
          onChange?.(series)
        }).catch((error) => {
          console.error('❌ [ColorType] Failed to load slices:', error)
          // Fallback : créer des slices vides si le chargement échoue
          onChange?.(series)
        })
      } else if (categoryType === CategoryType.ByField) {
        const slices = getByFieldPieSlices(numericFields, COLORS_SET[0], outline)
        series = Immutable.setIn(
          series,
          ['0', 'fillSymbol'],
          defaultFillSymbol.set('color', DefaultColorBySlicesOtherColor)
        )
        series = Immutable.setIn(series, ['0', 'slices'], slices)
        onChange?.(series)
      }
    }
  }

  const handleSlicesChange = (slices: ImmutableArray<WebChartPieChartSlice>) => {
    console.log('ColorType handleSlicesChange input:', slices)
    const series = Immutable.setIn(propSeries, ['0', 'slices'], slices)
    console.log('ColorType handleSlicesChange output:', series)
    onChange?.(series)
  }

  const handleOtherChange = (
    fillSymbol: ImmutableObject<ISimpleFillSymbol>
  ) => {
    const series = Immutable.setIn(propSeries, ['0', 'fillSymbol'], fillSymbol)
    onChange?.(series)
  }

  return (
    <>
      <div role='radiogroup' className={classNames(className, 'w-100')} aria-label={translate('themeSettingColorMode')}>
        <div className='d-flex align-items-center justify-content-between'>
          <Label
            title={translate('byCategory')}
            className='d-flex align-items-center text-truncate'
            style={{ width: '60%' }}
          >
            <Radio
              name='color-mode'
              className='mr-2'
              aria-label={translate('byCategory')}
              checked={colorMode === 'bySlices'}
              onChange={() => { handleColorTypeChange('bySlices') }}
            />
            {translate('byCategory')}
          </Label>
          {colorMode === 'bySlices' && (
            <Button
              ref={colorMatchBtnRef}
              type='tertiary'
              active={open}
              icon
              size='sm'
              aria-label={translate('byCategory')}
              onClick={() => { setOpen(!open) }}
            >
              <SettingOutlined />
            </Button>
          )}
        </div>
        <div className='d-flex align-items-center justify-content-between'>
          <Label
            title={translate('singleColor')}
            className='d-flex align-items-center text-truncate'
            style={{ width: '60%' }}
          >
            <Radio
              name='color-mode'
              aria-label={translate('singleColor')}
              className='mr-2'
              checked={colorMode === 'singleColor'}
              onChange={() => { handleColorTypeChange('singleColor') }}
            />
            {translate('singleColor')}
          </Label>
          {colorMode === 'singleColor' && (
            <SimpleColorPicker
              value={singleColor}
              ariaLabel={translate('singleColor')}
              onChange={handleSingleColorChange}
            />
          )}
        </div>
      </div>
      <ColorList
        open={open}
        trigger={colorMatchBtnRef.current}
        onRequestClose={() => { setOpen(false) }}
        categoryType={categoryType}
        loadSlices={loadSlices}
        loading={loading}
        value={propSlices}
        other={fillSymbol}
        colors={colors}
        onColorsChange={onColorsChange}
        onChange={handleSlicesChange}
        onOtherChange={handleOtherChange} />
    </>
  )
}
