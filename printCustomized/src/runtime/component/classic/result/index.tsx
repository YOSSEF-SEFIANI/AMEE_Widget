/** @jsx jsx */
import { React, jsx, css, polished, classNames, hooks } from 'jimu-core'
import { Button, Loading, LoadingType, defaultMessages as jimuUiDefaultMessage } from 'jimu-ui'
import { type IMConfig, type IMPrintResultList, type PrintResultListItemType, PrintResultState } from '../../../../config'
import { getCredentialToken } from '../../../utils/utils'
import defaultMessage from '../../../translations/default'
import { CloseOutlined } from 'jimu-icons/outlined/editor/close'
import { PageOutlined } from 'jimu-icons/outlined/data/page'
import { WrongOutlined } from 'jimu-icons/outlined/suggested/wrong'
const { useEffect, useState } = React
interface Props {
  config: IMConfig
  printResultList: IMPrintResultList
  deleteResultItem: (index: number) => void
}

const Result = (props: Props) => {
  const nls = hooks.useTranslation(defaultMessage, jimuUiDefaultMessage)
  const STYLE = css`
    & {
      overflow: auto;
      padding: ${polished.rem(16)} ${polished.rem(16)} ${polished.rem(16)} ${polished.rem(16)};
    }
    .result-button {
      padding-left: 0;
      padding-right: 0;
    }
    a {
      padding: 0;
    }
    .print-loading-con {
      width: 16px;
      height: 16px;
      margin-right: ${polished.rem(4)};
    }
    a.result-button{
      &:hover {
        color: var(--sys-color-primary-main);
        background: none;
        text-decoration: underline;
      }
    }
    .error-link, .error-link:hover {
      color: var(--ref-palette-neutral-1200);
      & svg {
        color: var(--sys-color-error-dark);
      }
    }
  `
  const { printResultList, config, deleteResultItem } = props
  const [credentialToken, setCredentialToken] = useState(null)

  useEffect(() => {
    getCredentialToken(config.useUtility).then(token => {
      setCredentialToken(token)
    })
  }, [config.useUtility])

  const renderLoading = () => {
    return (<div className='print-loading-con position-relative'><Loading width={16} height={16} type={LoadingType.Donut}/></div>)
  }

  const renderResultItemIcon = (item: PrintResultListItemType) => {
    switch (item.state) {
      case PrintResultState.Loading:
        return renderLoading()
      case PrintResultState.Success:
        return (<PageOutlined/>)
      case PrintResultState.Error:
        return (<span title={nls('uploadImageError')}><WrongOutlined /></span>)
    }
  }

  return (
    <div className='w-100 h-100' css={STYLE}>
      {printResultList?.length === 0 && <div>{nls('resultEmptyMessage')}</div>}
      {printResultList.map((item, index) => {
        return (
          <div className='d-flex align-items-center mb-2 w-100' key={item?.resultId}>
            <Button
              href={credentialToken ? `${item?.url}?token=${credentialToken}` : item?.url}
              disabled={!item?.url}
              target='_blank'
              size='sm'
              aria-label={item?.title}
              title={item?.state !== PrintResultState.Error ? item?.title : ''}
              type='tertiary'
              className={classNames('flex-grow-1 d-flex align-items-center result-button', { 'error-link': item?.state === PrintResultState.Error })}
            >
              {renderResultItemIcon(item)}
              <div className='ml-2 flex-grow-1 text-left' title={item?.state === PrintResultState.Error ? item?.title : ''}>{item?.title}</div>
            </Button>
            <Button icon size='sm' type='tertiary' onClick={() => { deleteResultItem(index) }} title={nls('remove')}><CloseOutlined/></Button>
          </div>
        )
      })}
    </div>
  )
}

export default Result
