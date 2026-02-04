/** @jsx jsx */
import { React, jsx, css, classNames, hooks, type IMUseUtility } from 'jimu-core'
import { Button, defaultMessages as jimuUiDefaultMessage } from 'jimu-ui'
import { PrintResultState, type IMPrintResultListItemType } from '../../../config'
import defaultMessage from '../../translations/default'
import { PageOutlined } from 'jimu-icons/outlined/data/page'
import PrintLoading from '../loading-icon'
import { getCredentialToken } from '../../utils/utils'
import { WrongOutlined } from 'jimu-icons/outlined/suggested/wrong'
const { useEffect, useState } = React

interface Props {
  useUtility: IMUseUtility
  printResult: IMPrintResultListItemType
  restPrint: () => void
}

const Result = (props: Props) => {
  const nls = hooks.useTranslation(defaultMessage, jimuUiDefaultMessage)

  const { printResult, useUtility, restPrint } = props
  const [credentialToken, setCredentialToken] = useState(null)

  const STYLE = css`
    .error-link, .error-link:hover {
      color: var(--ref-palette-neutral-1200);
      & svg {
        color: var(--sys-color-error-dark);
      }
    }
    a.result-button{
      &:hover {
        color: var(--sys-color-primary-main);
        background: none;
        text-decoration: underline;
      }
    }
  `

  useEffect(() => {
    getCredentialToken(useUtility).then(token => {
      setCredentialToken(token)
    })
  }, [useUtility])

  const renderResultItemIcon = () => {
    switch (printResult?.state) {
      case PrintResultState.Loading:
        return <PrintLoading/>
      case PrintResultState.Success:
        return (<PageOutlined/>)
      case PrintResultState.Error:
        return (<span title={nls('uploadImageError')}><WrongOutlined /></span>)
    }
  }

  return (
    <div className='d-flex flex-column h-100 w-100 result-con' css={STYLE}>
      <Button
        href={credentialToken ? `${printResult?.url}?token=${credentialToken}` : printResult?.url}
        disabled={!printResult?.url}
        target='_blank'
        size='sm'
        aria-label={printResult?.title}
        title={printResult?.title}
        type='tertiary'
        className={classNames('d-flex align-items-center', { 'error-link': printResult?.state === PrintResultState.Error })}
      >
        {renderResultItemIcon()}
        <div className='ml-2 flex-grow-1 text-left'>{printResult?.title}</div>
      </Button>
      <div className='flex-grow-1 d-flex align-items-end'>
        <div className='flex-grow-1'></div>
        <Button type='primary' onClick={restPrint}>{nls('reset')}</Button>
      </div>
    </div>
  )
}

export default Result
