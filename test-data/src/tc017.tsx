// testcase: type|6-9


import React from 'react';

/**
 * My component properties
 */
type MyComponentProps = {
  message: string;
};

const MyComponent: React.FC<MyComponentProps> = ({ message }) => {
  return <div>{message}</div>;
};

export default MyComponent;