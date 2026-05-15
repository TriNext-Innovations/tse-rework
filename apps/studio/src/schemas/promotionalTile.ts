import { defineField, defineType } from 'sanity'

export const promotionalTile = defineType({
  name: 'promotionalTile',
  title: 'Promotional Tile',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'linkUrl',
      title: 'Link URL',
      type: 'string',
      description: 'Internal path (e.g. /shop/hp) or external URL',
    }),
    defineField({
      name: 'badgeLabel',
      title: 'Badge Label',
      type: 'string',
      description: 'Optional badge text, e.g. "Sale" or "New"',
    }),
    defineField({
      name: 'order',
      title: 'Display Order',
      type: 'number',
    }),
    defineField({
      name: 'active',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  orderings: [
    { title: 'Display Order', name: 'orderAsc', by: [{ field: 'order', direction: 'asc' }] },
  ],
  preview: {
    select: { title: 'title', media: 'image', subtitle: 'badgeLabel' },
  },
})
