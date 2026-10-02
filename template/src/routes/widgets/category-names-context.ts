// The context behind <CategoryName> (category-names.tsx), in its own file so
// that file exports only components (fast refresh).
import { createContext } from 'react'

export const CategoryNamesContext = createContext<ReadonlyMap<number, string>>(new Map())
