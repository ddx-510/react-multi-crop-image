import React from 'react'

const defaultDeleteStyles = {
  container: {
    width: 15,
    height: 15,
    cursor: 'pointer',
    float: 'right',
    background: '#262626',
    opacity: 0.8,
  } as const,
  
  icon: {
    color: 'white',
    position: 'absolute' as const,
    marginTop: 6,
  } as const,
}

const defaultNumberStyles = {
  width: 15,
  height: 15,
  float: 'left',
  fontSize: 12,
  background: '#262626',
  textAlign: 'center',
  lineHeight: '15px',
  color: 'white',
  opacity: 0.8,
} as const

interface DeleteIconProps extends React.HTMLAttributes<HTMLDivElement> {
  deleteIconContainerStyle?: React.CSSProperties;
  deleteIconStyle?: React.CSSProperties;
}

export const DeleteIcon: React.FC<DeleteIconProps> = ({ deleteIconContainerStyle, deleteIconStyle, ...props }) => (
  <>
    <div
      className="rmc-icon-container"
      style={{ ...defaultDeleteStyles.container, ...deleteIconContainerStyle }}
      {...props}
    >
      <div 
        className="rmc-remove" 
        style={{ ...defaultDeleteStyles.icon, ...deleteIconStyle }} 
      />
    </div>
    <style>{`
      .rmc-remove:before, .rmc-remove:after {
        content: '';
        position: absolute;
        width: 15px;
        height: 1px;
        background-color: currentColor;
      }
      .rmc-remove:before {
        transform: rotate(45deg);
      }
      .rmc-remove:after {
        transform: rotate(-45deg);
      }
    `}</style>
  </>
)

interface NumberIconProps {
  number?: string | number;
  numberIconStyle?: React.CSSProperties;
}

export const NumberIcon: React.FC<NumberIconProps> = ({ number, numberIconStyle }) => (
  <div 
    className="rmc-number" 
    style={{ ...defaultNumberStyles, ...numberIconStyle }}
  >
    {number}
  </div>
)
