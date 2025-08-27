"use client";
import { createContext, useContext, useState, ReactNode } from 'react';

type FormType = 'home' | 'create';

interface FormContextType {
  activeForm: FormType;
  setActiveForm: (form: FormType) => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

export function FormProvider({ children }: { children: ReactNode }) {
  const [activeForm, setActiveForm] = useState<FormType>('home');

  return (
    <FormContext.Provider value={{ activeForm, setActiveForm }}>
      {children}
    </FormContext.Provider>
  );
}

export function useForm() {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useForm must be used within FormProvider');
  }
  return context;
}
