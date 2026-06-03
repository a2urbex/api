import dao from 'dao'

type Category = {
  id: number
  name: string
  icon: string
  color: string | null
}

type CategoryOption = {
  id: number
  name: string
  category: Category
}

let categoryOptions: CategoryOption[] = []

const categoryService = {
  init: async () => {
    categoryOptions = await dao.category.getAll()
  },

  getCategory: (name: string): Category | undefined => {
    const lowerName = name.toLowerCase()
    for (const option of categoryOptions) {
      if (lowerName.includes(option.name.toLowerCase())) return option.category
    }
  },
}

export default categoryService
